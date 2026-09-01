import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { Worker } from 'node:worker_threads';

const IMAGE_PATH = fileURLToPath(new URL('../kb/generated/kb.pvm', import.meta.url));
const WORKER_URL = new URL('./engine-worker.mjs', import.meta.url);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

class EngineHost {
  #events = [];
  #eventWaiters = [];
  #nextId = 0;
  #pending = new Map();
  #terminating = false;
  #worker;
  state = 'empty';
  failures = [];
  output = [];

  #emit(event) {
    this.#events.push({ ...event, receivedAt: performance.now() });
    for (const waiter of [...this.#eventWaiters]) {
      if (waiter.name !== event.event) continue;
      clearTimeout(waiter.timer);
      this.#eventWaiters.splice(this.#eventWaiters.indexOf(waiter), 1);
      waiter.resolve(this.#events.at(-1));
    }
  }

  #settleAll(code, message) {
    for (const [id, resolve] of this.#pending) {
      resolve({ id, ok: false, error: { code, message } });
    }
    this.#pending.clear();
  }

  #attach(worker) {
    worker.stdout?.on('data', (chunk) =>
      this.output.push({ stream: 'stdout', text: chunk.toString() }),
    );
    worker.stderr?.on('data', (chunk) =>
      this.output.push({ stream: 'stderr', text: chunk.toString() }),
    );
    worker.on('message', (message) => {
      if (message.event !== undefined) {
        this.#emit(message);
        return;
      }
      const resolve = this.#pending.get(message.id);
      if (resolve === undefined) {
        this.failures.push({ code: 'unmatched-response', message });
        return;
      }
      this.#pending.delete(message.id);
      resolve(message);
    });
    worker.on('error', (error) => {
      this.failures.push({ code: 'worker-error', name: error.name, message: error.message });
      this.#settleAll('worker-error', error.message);
      this.state = 'dead';
    });
    worker.on('messageerror', (error) => {
      this.failures.push({ code: 'message-error', message: String(error) });
      this.#settleAll('message-error', String(error));
      this.state = 'dead';
    });
    worker.on('exit', (code) => {
      if (!this.#terminating) {
        this.failures.push({ code: 'worker-exit', exitCode: code });
        this.#settleAll('worker-exit', `worker exited with code ${code}`);
        this.state = 'dead';
      }
    });
  }

  #raw(kind, payload = {}) {
    const id = `p${++this.#nextId}`;
    return new Promise((resolve) => {
      this.#pending.set(id, resolve);
      this.#worker.postMessage({ id, kind, ...payload });
    });
  }

  async spawn() {
    if (this.#worker !== undefined) throw new Error('worker already exists');
    this.state = 'booting';
    const worker = new Worker(WORKER_URL, {
      type: 'module',
      workerData: { imagePath: IMAGE_PATH },
      stdout: true,
      stderr: true,
    });
    this.#worker = worker;
    this.#attach(worker);
    const response = await this.#raw('boot');
    if (!response.ok) {
      this.state = 'dead';
      throw new Error(`boot failed: ${response.error.message}`);
    }
    this.state = 'ready';
    return response.result;
  }

  request(kind, payload = {}) {
    if (this.state !== 'ready') {
      return Promise.resolve({
        id: 'host',
        ok: false,
        error: {
          code: 'worker-restarting',
          message: `worker is ${this.state}`,
        },
      });
    }
    return this.#raw(kind, payload);
  }

  waitForEvent(name, timeoutMs = 5_000) {
    const existing = this.#events.find((event) => event.event === name);
    if (existing !== undefined) return Promise.resolve(existing);
    return new Promise((resolve, reject) => {
      const waiter = {
        name,
        resolve,
        timer: setTimeout(() => {
          this.#eventWaiters.splice(this.#eventWaiters.indexOf(waiter), 1);
          reject(new Error(`timed out waiting for ${name}`));
        }, timeoutMs),
      };
      this.#eventWaiters.push(waiter);
    });
  }

  events(name) {
    return this.#events.filter((event) => name === undefined || event.event === name);
  }

  async hardStop(message = 'hard cancel') {
    const worker = this.#worker;
    if (worker === undefined) return { terminateMs: 0, exitCode: undefined, aborted: 0 };
    this.state = 'restarting';
    const aborted = this.#pending.size;
    this.#settleAll('worker-terminated', message);
    this.#terminating = true;
    const started = performance.now();
    const exitCode = await worker.terminate();
    const terminateMs = performance.now() - started;
    this.#worker = undefined;
    this.#terminating = false;
    this.state = 'empty';
    return { terminateMs, exitCode, aborted };
  }
}

const taskIds = () =>
  readdirSync('/proc/self/task')
    .filter((name) => /^\d+$/.test(name))
    .map(Number)
    .sort((left, right) => left - right);

const taskTicks = (tid) => {
  try {
    const stat = readFileSync(`/proc/self/task/${tid}/stat`, 'utf8');
    const fields = stat
      .slice(stat.lastIndexOf(') ') + 2)
      .trim()
      .split(/\s+/);
    return Number(fields[11]) + Number(fields[12]);
  } catch (error) {
    if (error?.code === 'ENOENT') return undefined;
    throw error;
  }
};

const rssKiB = () => {
  const match = /^VmRSS:\s+(\d+)\s+kB$/m.exec(readFileSync('/proc/self/status', 'utf8'));
  if (match === null) throw new Error('VmRSS is absent');
  return Number(match[1]);
};

const waitForTasksGone = async (ids, timeoutMs) => {
  const started = performance.now();
  while (performance.now() - started < timeoutMs) {
    const live = new Set(taskIds());
    if (ids.every((id) => !live.has(id))) return performance.now() - started;
    await sleep(1);
  }
  return undefined;
};

const summarizeSlice = async () => {
  const host = new EngineHost();
  const boot = await host.spawn();
  const response = await host.request('slice', { runs: 10, wallMs: 1_000, cap: 10 });
  const stop = await host.hardStop('slice complete');
  if (!response.ok) throw new Error(response.error.message);
  const result = response.result;
  const stepMs = [...result.stepMs].sort((left, right) => left - right);
  return {
    boot,
    runs: result.runs,
    wallMs: result.wallMs,
    cap: result.cap,
    statuses: result.statuses,
    counts: result.counts,
    queryElapsedMs: result.elapsedMs,
    stepCount: stepMs.length,
    maxStepMs: stepMs.at(-1),
    p95StepMs: stepMs[Math.floor(stepMs.length * 0.95)],
    solutions: result.solutions,
    capProbe: result.capProbe,
    stop,
  };
};

const summarizeTerminate = async () => {
  const tasksBefore = taskIds();
  const host = new EngineHost();
  const boot = await host.spawn();
  const tasksBooted = taskIds();
  const workerTasks = tasksBooted.filter((id) => !tasksBefore.includes(id));
  const ticksBefore = Object.fromEntries(workerTasks.map((id) => [id, taskTicks(id)]));

  const spinPromise = host.request('spin', { workerTimerMs: 25 });
  const spinStarted = await host.waitForEvent('spin-start');
  const cpuBefore = process.cpuUsage();
  const wallStarted = performance.now();
  const mainTimer = await new Promise((resolve) => {
    const scheduled = performance.now();
    setTimeout(() => resolve(performance.now() - scheduled), 25);
  });
  await sleep(Math.max(0, 250 - (performance.now() - wallStarted)));
  const hostileBlockedMs = performance.now() - wallStarted;
  const cpuDuring = process.cpuUsage(cpuBefore);
  const ticksDuring = Object.fromEntries(
    workerTasks.map((id) => [id, { before: ticksBefore[id], after: taskTicks(id) }]),
  );
  const workerTimerFiredBeforeStop = host.events('worker-timer').length > 0;

  const stop = await host.hardStop('main watchdog expired');
  const spinOutcome = await spinPromise;
  const tasksGoneMs = await waitForTasksGone(workerTasks, 1_000);
  const cpuIdleBefore = process.cpuUsage();
  await sleep(200);
  const cpuAfterStop = process.cpuUsage(cpuIdleBefore);

  return {
    boot,
    workerTasks,
    spinStarted,
    budgetMs: 10,
    hostileBlockedMs,
    budgetOvershootLowerBoundMs: hostileBlockedMs - 10,
    mainTimerRequestedMs: 25,
    mainTimerDelayMs: mainTimer,
    workerTimerRequestedMs: 25,
    workerTimerFiredBeforeStop,
    cpuDuringSpinMs: (cpuDuring.user + cpuDuring.system) / 1_000,
    taskTicksDuringSpin: ticksDuring,
    stop,
    spinOutcome,
    tasksGoneMs,
    workerTasksGone: workerTasks.every((id) => !taskIds().includes(id)),
    cpuDuringPostStopIdleMs: (cpuAfterStop.user + cpuAfterStop.system) / 1_000,
  };
};

const summarizeRecreate = async () => {
  const host = new EngineHost();
  const initial = await host.spawn();
  const cycles = [];
  for (let index = 0; index < 5; index += 1) {
    const started = performance.now();
    const stop = await host.hardStop(`recreate cycle ${index + 1}`);
    const boot = await host.spawn();
    const state = await host.request('state');
    cycles.push({
      cycle: index + 1,
      totalMs: performance.now() - started,
      terminateMs: stop.terminateMs,
      bootMs: boot.bootMs,
      documents: state.ok ? state.result.documents : undefined,
      schemaVersion: boot.contract.schemaVersion,
    });
  }
  await host.hardStop('recreate probe complete');
  return { initial, cycles };
};

const summarizeResidue = async () => {
  const host = new EngineHost();
  const bootBefore = await host.spawn();
  const baseline = await host.request('state');
  const asserted = await host.request('overlay');
  const visible = await host.request('state');
  const spinPromise = host.request('spin', { workerTimerMs: 10 });
  await host.waitForEvent('spin-start');
  const cancelStarted = performance.now();
  const stop = await host.hardStop('cancel after overlay assertion');
  const cancelled = await spinPromise;
  const bootAfter = await host.spawn();
  const clean = await host.request('state');
  const totalRecoveryMs = performance.now() - cancelStarted;
  await host.hardStop('residue probe complete');
  return {
    bootBefore,
    baseline,
    asserted,
    visible,
    stop,
    cancelled,
    bootAfter,
    clean,
    totalRecoveryMs,
  };
};

const summarizeInflight = async () => {
  const unhandled = [];
  const onUnhandled = (reason) => unhandled.push(String(reason));
  process.on('unhandledRejection', onUnhandled);
  const host = new EngineHost();
  await host.spawn();
  const first = host.request('spin', { workerTimerMs: 10 });
  await host.waitForEvent('spin-start');
  const second = host.request('state');
  const stopStarted = performance.now();
  const firstStamped = first.then((outcome) => ({
    outcome,
    settledMs: performance.now() - stopStarted,
  }));
  const secondStamped = second.then((outcome) => ({
    outcome,
    settledMs: performance.now() - stopStarted,
  }));
  const stop = await host.hardStop('two in-flight requests cancelled');
  const [firstResult, secondResult] = await Promise.all([firstStamped, secondStamped]);

  const respawn = host.spawn();
  const during = await host.request('state');
  const boot = await respawn;
  const after = await host.request('state');
  await sleep(25);
  await host.hardStop('in-flight probe complete');
  process.off('unhandledRejection', onUnhandled);
  return {
    firstResult,
    secondResult,
    stop,
    during,
    boot,
    after,
    unhandled,
    hostFailures: host.failures,
  };
};

const summarizeConsult = async () => {
  const host = new EngineHost();
  const boot = await host.spawn();
  const consult = await host.request('consult');
  await host.hardStop('consult probe complete');
  return { boot, consult, workerOutput: host.output };
};

const summarizeBenchmark = async () => {
  const host = new EngineHost();
  const boot = await host.spawn();
  const benchmark = await host.request('benchmark', { pairs: 20, wallMs: 1_000, cap: 10 });
  await host.hardStop('benchmark complete');
  return { boot, benchmark };
};

const summarizeMemory = async () => {
  const cells = Number(process.argv[3] ?? 200_000_000);
  const stackLimit = Number(process.argv[4] ?? 4_000_000_000);
  const watchdogMs = Number(process.argv[5] ?? 45_000);
  const host = new EngineHost();
  const boot = await host.spawn();
  const baselineRssKiB = rssKiB();
  let settled = false;
  let outcome;
  const request = host.request('memory', { cells, stackLimit }).then((value) => {
    settled = true;
    outcome = value;
    return value;
  });
  await host.waitForEvent('memory-start');
  const started = performance.now();
  let peakRssKiB = baselineRssKiB;
  while (!settled && performance.now() - started < watchdogMs) {
    peakRssKiB = Math.max(peakRssKiB, rssKiB());
    await sleep(20);
  }
  peakRssKiB = Math.max(peakRssKiB, rssKiB());
  let watchdogStop;
  if (!settled) watchdogStop = await host.hardStop('memory watchdog expired');
  await request;
  const stop = watchdogStop ?? (await host.hardStop('memory probe complete'));
  return {
    boot,
    cells,
    stackLimit,
    watchdogMs,
    elapsedMs: performance.now() - started,
    baselineRssKiB,
    peakRssKiB,
    outcome,
    stop,
    hostFailures: host.failures,
  };
};

const summarizeHeap = async () => {
  const chunkCells = Number(process.argv[3] ?? 100_000);
  const watchdogMs = Number(process.argv[4] ?? 45_000);
  const host = new EngineHost();
  const boot = await host.spawn();
  const baselineRssKiB = rssKiB();
  let settled = false;
  let outcome;
  const request = host.request('heap', { chunkCells }).then((value) => {
    settled = true;
    outcome = value;
    return value;
  });
  await host.waitForEvent('memory-start');
  const started = performance.now();
  let peakRssKiB = baselineRssKiB;
  while (!settled && performance.now() - started < watchdogMs) {
    peakRssKiB = Math.max(peakRssKiB, rssKiB());
    await sleep(20);
  }
  peakRssKiB = Math.max(peakRssKiB, rssKiB());
  let watchdogStop;
  if (!settled) watchdogStop = await host.hardStop('heap watchdog expired');
  await request;
  const stop = watchdogStop ?? (await host.hardStop('heap probe complete'));
  return {
    boot,
    chunkCells,
    watchdogMs,
    elapsedMs: performance.now() - started,
    baselineRssKiB,
    peakRssKiB,
    outcome,
    stop,
    hostFailures: host.failures,
    workerOutput: host.output,
  };
};

const modes = {
  slice: summarizeSlice,
  terminate: summarizeTerminate,
  recreate: summarizeRecreate,
  residue: summarizeResidue,
  inflight: summarizeInflight,
  consult: summarizeConsult,
  benchmark: summarizeBenchmark,
  memory: summarizeMemory,
  heap: summarizeHeap,
};

const mode = process.argv[2];
if (!(mode in modes)) {
  throw new Error(`usage: node probe/run.mjs <${Object.keys(modes).join('|')}>`);
}
const result = await modes[mode]();
process.stdout.write(`${JSON.stringify({ mode, result }, null, 2)}\n`);
