#!/usr/bin/env node
// `pnpm chat:dev` — the local chat bridge (`.agent/contracts/chat-c3.md`).
//
// One persistent `codex app-server` child speaks newline-delimited JSON-RPC 2.0 on stdio, the
// shape of `../live-stt/` `CodexTranslator`. The bridge never runs a goal: a `prolog_query` call
// is forwarded to the browser, which runs it in its own engine and posts the result back, so the
// answer the model reads is the answer the page shows.
//
// It spends the user's subscription, so it binds 127.0.0.1 and refuses any request whose `Host`
// or `Origin` is not local before reading its body: a cross-site form POST and a DNS-rebinding
// page would otherwise reach it.

import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const MODEL = 'gpt-6.1-sol';
export const EFFORT = 'medium';
export const PORT = 8792;
export const ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
];
export const MESSAGE_MAX = 4000;
export const RESULT_MAX = 16384;
/** Room for `RESULT_MAX` characters at their worst form encoding, 9 bytes each. */
export const BODY_MAX = 262144;
const DRAIN_MAX = 4 * BODY_MAX;
export const DEADLINES = Object.freeze({ callMs: 30_000, turnMs: 180_000, controlMs: 30_000 });

/**
 * `-c` overrides for the child. Under gpt-6.1-sol's catalog entry no combination removed the
 * `exec` and collaboration tools from the request (`chat-plan.md` `Isolation`), so these narrow
 * the surface and the server-request refusals below contain the rest.
 */
export const CODEX_CONFIG = Object.freeze({
  web_search: '"live"',
  project_doc_max_bytes: '0',
  mcp_servers: '{}',
  ...Object.fromEntries(
    [
      'shell_tool',
      'unified_exec',
      'view_image',
      'multi_agent',
      'image_generation',
      'browser_use',
      'browser_use_external',
      'computer_use',
      'apps',
      'plugins',
      'tool_suggest',
      'sleep_tool',
      'goals',
      'hooks',
      'skill_search',
      'memories',
    ].map((feature) => [`features.${feature}`, 'false']),
  ),
});

export const PROLOG_TOOL = Object.freeze({
  type: 'function',
  name: 'prolog_query',
  description:
    'Run one read-only Prolog goal against the guideline knowledge base in the reader’s browser. ' +
    'Write one goal with no trailing period. Returns the call id, the outcome and every ' +
    'solution the engine proved.',
  inputSchema: {
    type: 'object',
    properties: { goal: { type: 'string' } },
    required: ['goal'],
    additionalProperties: false,
  },
});

export const OUTPUT_SCHEMA = Object.freeze({
  type: 'object',
  properties: {
    segments: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          text: { type: 'string' },
          source: { type: 'string', enum: ['kb', 'web', 'model'] },
          queries: { type: 'array', items: { type: 'string' } },
          urls: { type: 'array', items: { type: 'string' } },
        },
        required: ['text', 'source', 'queries', 'urls'],
        additionalProperties: false,
      },
    },
  },
  required: ['segments'],
  additionalProperties: false,
});

const GUIDE = fileURLToPath(new URL('./chat-guide.md', import.meta.url));

/**
 * The schema-valid answer that grants nothing, per server request the child can send besides
 * `item/tool/call`. A method absent here (`account/chatgptAuthTokens/refresh`,
 * `attestation/generate`, anything newer) gets JSON-RPC `-32601`.
 */
const REFUSALS = new Map([
  ['item/commandExecution/requestApproval', () => ({ decision: 'decline' })],
  ['item/fileChange/requestApproval', () => ({ decision: 'decline' })],
  ['item/permissions/requestApproval', () => ({ permissions: {} })],
  ['item/tool/requestUserInput', () => ({ answers: {} })],
  ['mcpServer/elicitation/request', () => ({ action: 'decline' })],
  [
    'applyPatchApproval',
    () => ({ decision: { denied: { rejection: 'this client approves nothing' } } }),
  ],
  [
    'execCommandApproval',
    () => ({ decision: { denied: { rejection: 'this client approves nothing' } } }),
  ],
  ['currentTime/read', () => ({ currentTimeAt: Math.floor(Date.now() / 1000) })],
]);

/** @typedef {{ type: string, [key: string]: unknown }} ChatEvent */
/** @typedef {(event: ChatEvent) => void} Emit */
/** @typedef {{ callMs: number, turnMs: number, controlMs: number }} Deadlines */

/**
 * @typedef {object} Turn
 * @property {string} id
 * @property {Emit} emit
 * @property {() => void} finish
 * @property {boolean} failed
 * @property {boolean} closed  set by `finish`, synchronously: a line after `turn/completed` in
 *   the same chunk finds the turn closed before the awaiting code resumes
 */

/**
 * @typedef {object} Conversation
 * @property {string} id
 * @property {AppServer} child
 * @property {string} threadId
 * @property {number} calls
 * @property {Map<string, { rpcId: unknown, timer: NodeJS.Timeout }>} pending
 * @property {Turn | undefined} turn
 * @property {boolean} busy
 */

/** @param {unknown} value @returns {value is Record<string, unknown>} */
const isRecord = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);

/** @param {unknown} value @returns {string} */
const text = (value) => (typeof value === 'string' ? value : '');

/** @param {string} detail */
const toolText = (detail) => ({
  contentItems: [{ type: 'inputText', text: detail }],
  success: false,
});

/** A child that left a control request unanswered past `controlMs`; it is retired. */
class ControlTimeout extends Error {
  name = 'ControlTimeout';
}

/** One `codex app-server` child and its JSON-RPC correlation. */
class AppServer {
  /** @type {import('node:child_process').ChildProcessByStdio<import('node:stream').Writable, import('node:stream').Readable, null>} */
  #child;
  #next = 0;
  /** @type {Map<number, { resolve: (value: unknown) => void, reject: (error: Error) => void }>} */
  #pending = new Map();
  alive = true;

  /**
   * @param {string[]} argv
   * @param {string} home
   * @param {{ request: (message: Record<string, unknown>) => void, notification: (message: Record<string, unknown>) => void, exit: () => void }} on
   */
  constructor(argv, home, on) {
    const [command = 'codex', ...prefix] = argv;
    const flags = Object.entries(CODEX_CONFIG).flatMap(([key, value]) => ['-c', `${key}=${value}`]);
    this.#child = spawn(command, [...prefix, 'app-server', ...flags], {
      env: { ...process.env, CODEX_HOME: home },
      stdio: ['pipe', 'pipe', 'ignore'],
    });
    this.#child.on('error', () => {
      this.#end();
      on.exit();
    });
    this.#child.on('exit', () => {
      this.#end();
      on.exit();
    });
    createInterface({ input: this.#child.stdout }).on('line', (line) => {
      /** @type {unknown} */
      let message;
      try {
        message = JSON.parse(line);
      } catch {
        return;
      }
      if (!isRecord(message)) return;
      if ('id' in message && ('result' in message || 'error' in message)) {
        const waiter = typeof message.id === 'number' ? this.#pending.get(message.id) : undefined;
        if (waiter === undefined) return;
        this.#pending.delete(/** @type {number} */ (message.id));
        if (message.error !== undefined) {
          const error = isRecord(message.error) ? text(message.error.message) : '';
          waiter.reject(new Error(error || 'app-server error'));
        } else waiter.resolve(message.result);
      } else if (typeof message.method === 'string') {
        if ('id' in message) on.request(message);
        else on.notification(message);
      }
    });
  }

  #end() {
    if (!this.alive) return;
    this.alive = false;
    for (const waiter of this.#pending.values()) waiter.reject(new Error('app-server exited'));
    this.#pending.clear();
  }

  /** @param {Record<string, unknown>} message */
  #send(message) {
    if (!this.alive) return;
    this.#child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', ...message })}\n`);
  }

  /**
   * `onResult` runs synchronously on the response line, before any later line of the same
   * stdout chunk: readline emits a chunk's lines in one loop, so an awaiting caller resumes only
   * after the events that followed its response.
   *
   * @param {string} method
   * @param {Record<string, unknown>} params
   * @param {number} [timeoutMs]
   * @param {(result: unknown) => void} [onResult]
   * @returns {Promise<unknown>}
   */
  request(method, params, timeoutMs, onResult) {
    if (!this.alive) return Promise.reject(new Error('app-server exited'));
    const id = ++this.#next;
    return new Promise((resolve, reject) => {
      const timer =
        timeoutMs === undefined
          ? undefined
          : setTimeout(() => {
              this.#pending.delete(id);
              reject(new ControlTimeout(`${method} exceeded ${String(timeoutMs)} ms`));
            }, timeoutMs);
      this.#pending.set(id, {
        resolve: (value) => {
          clearTimeout(timer);
          onResult?.(value);
          resolve(value);
        },
        reject: (error) => {
          clearTimeout(timer);
          reject(error);
        },
      });
      this.#send({ id, method, params });
    });
  }

  /** @param {string} method @param {Record<string, unknown>} params */
  notify(method, params) {
    this.#send({ method, params });
  }

  /** @param {unknown} id @param {unknown} result */
  respond(id, result) {
    this.#send({ id, result });
  }

  /** @param {unknown} id @param {number} code @param {string} message */
  refuse(id, code, message) {
    this.#send({ id, error: { code, message } });
  }

  /** Resolves once the child exited; one that outlives `graceMs` after SIGTERM gets SIGKILL. */
  close(graceMs = 2000) {
    this.#end();
    const exited =
      this.#child.exitCode !== null || this.#child.signalCode !== null
        ? Promise.resolve()
        : new Promise((resolve) => {
            this.#child.once('exit', resolve);
            setTimeout(() => this.#child.kill('SIGKILL'), graceMs).unref();
          });
    this.#child.stdin.end();
    this.#child.kill('SIGTERM');
    return exited.then(() => undefined);
  }
}

/**
 * The provider refused the login, read off a turn error; the child retries it before failing.
 * Measured live: `codexErrorInfo.responseStreamDisconnected.httpStatusCode` 401 with
 * `additionalDetails` `unexpected status 401 Unauthorized`; the schema also admits the string
 * `codexErrorInfo` `'unauthorized'`.
 */
const unauthorized = (/** @type {unknown} */ error) =>
  isRecord(error) &&
  (error.codexErrorInfo === 'unauthorized' ||
    (isRecord(error.codexErrorInfo) &&
      isRecord(error.codexErrorInfo.responseStreamDisconnected) &&
      error.codexErrorInfo.responseStreamDisconnected.httpStatusCode === 401) ||
    /\b401\b|\bunauthori[sz]ed\b/iu.test(
      `${text(error.message)} ${text(error.additionalDetails)}`,
    ));

/** The conversations, their threads and the one child they share. */
class Bridge {
  /** @type {AppServer | undefined} */
  #child;
  /** @type {Promise<AppServer> | undefined} */
  #starting;
  /** @type {Map<string, Conversation>} */
  #conversations = new Map();
  /** @type {Map<string, Conversation>} */
  #threads = new Map();
  #cwd = mkdtempSync(join(tmpdir(), 'cnl-ckc-chat-'));
  #closed = false;

  /**
   * @param {{ codexCommand: string[], codexHome: string, guide: string, deadlines: Deadlines }} options
   */
  constructor(options) {
    this.options = options;
  }

  /** @returns {Promise<AppServer>} */
  #ensure() {
    if (this.#child?.alive === true) return Promise.resolve(this.#child);
    this.#starting ??= this.#start().finally(() => {
      this.#starting = undefined;
    });
    return this.#starting;
  }

  async #start() {
    const { codexCommand, codexHome, deadlines } = this.options;
    const child = new AppServer(codexCommand, codexHome, {
      request: (message) => {
        this.#onRequest(child, message);
      },
      notification: (message) => {
        this.#onNotification(message);
      },
      exit: () => {
        this.#onExit(child);
      },
    });
    this.#child = child;
    try {
      await child.request(
        'initialize',
        {
          clientInfo: { name: 'cnl-ckc-demo', title: 'cnl-ckc-demo chat', version: '1' },
          capabilities: { experimentalApi: true },
        },
        deadlines.controlMs,
      );
      child.notify('initialized', {});
    } catch (error) {
      void child.close();
      throw error;
    }
    return child;
  }

  /** Every conversation lived on the child that exited; its open turns end here. */
  #onExit(/** @type {AppServer} */ child) {
    if (this.#child !== child) return;
    this.#child = undefined;
    for (const conversation of this.#conversations.values()) {
      const { turn } = conversation;
      if (turn !== undefined) {
        if (!turn.failed)
          turn.emit({ type: 'error', reason: 'codex', message: 'the model server exited' });
        turn.failed = true;
        turn.finish();
      }
      this.#settleCalls(conversation, 'the model server exited');
    }
    this.#conversations.clear();
    this.#threads.clear();
  }

  /** @param {Conversation} conversation @param {string} reason */
  #settleCalls(conversation, reason) {
    for (const [call, { rpcId, timer }] of conversation.pending) {
      clearTimeout(timer);
      conversation.pending.delete(call);
      conversation.child.respond(rpcId, toolText(`${call}: ${reason}`));
    }
  }

  /** @param {AppServer} child @param {Record<string, unknown>} message */
  #onRequest(child, message) {
    const { id, method } = message;
    const params = isRecord(message.params) ? message.params : {};
    if (method === 'item/tool/call') {
      const conversation = this.#threads.get(text(params.threadId));
      const turn = conversation?.turn;
      const goal = isRecord(params.arguments) ? params.arguments.goal : undefined;
      if (
        conversation === undefined ||
        turn === undefined ||
        turn.closed ||
        turn.id === '' ||
        turn.id !== text(params.turnId) ||
        params.tool !== 'prolog_query' ||
        typeof goal !== 'string'
      ) {
        child.respond(
          id,
          toolText('refused: this bridge serves prolog_query calls of the open turn alone'),
        );
        return;
      }
      const call = `q${String(++conversation.calls)}`;
      const timer = setTimeout(() => {
        if (!conversation.pending.delete(call)) return;
        child.respond(id, toolText(`${call}: the browser did not answer in time`));
      }, this.options.deadlines.callMs);
      conversation.pending.set(call, { rpcId: id, timer });
      turn.emit({ type: 'query', call, goal });
      return;
    }
    const refusal = typeof method === 'string' ? REFUSALS.get(method) : undefined;
    if (refusal !== undefined) child.respond(id, refusal());
    else child.refuse(id, -32601, `${String(method)} is not supported by this client`);
  }

  /** @param {Record<string, unknown>} message */
  #onNotification(message) {
    const params = isRecord(message.params) ? message.params : {};
    const conversation = this.#threads.get(text(params.threadId));
    const turn = conversation?.turn;
    if (conversation === undefined || turn === undefined || turn.closed) return;
    // A thread runs one turn at a time (`turn` resolves only on that turn's end), so an event
    // naming another turn is a straggler; while the id is still unknown none can exist.
    const named = text(params.turnId) || (isRecord(params.turn) ? text(params.turn.id) : '');
    if (turn.id !== '' && named !== '' && named !== turn.id) return;
    switch (message.method) {
      case 'item/completed': {
        const item = isRecord(params.item) ? params.item : {};
        if (item.type === 'agentMessage') {
          const kind = item.phase === 'final_answer' ? 'answer' : 'commentary';
          turn.emit({ type: kind, text: text(item.text) });
        } else if (item.type === 'webSearch') {
          const results = Array.isArray(item.results) ? item.results.filter(isRecord) : [];
          turn.emit({
            type: 'search',
            query: text(item.query),
            action: isRecord(item.action) ? item.action : null,
            results: results.map((result) => ({
              url: text(result.url),
              title: text(result.title),
              domain: text(result.domain),
              snippet: text(result.snippet),
            })),
          });
        }
        return;
      }
      case 'error': {
        // A 401 is retried five times before the turn fails; the reader needs a login, not a wait.
        if (unauthorized(params.error))
          this.#fail(conversation, 'auth', 'the model server is not logged in');
        else if (params.willRetry === false) {
          const error = isRecord(params.error) ? text(params.error.message) : '';
          this.#fail(conversation, 'codex', error || 'the model server reported an error');
        }
        return;
      }
      case 'turn/completed': {
        const done = isRecord(params.turn) ? params.turn : {};
        if (done.status === 'failed' && !turn.failed) {
          const error = isRecord(done.error) ? done.error : {};
          turn.emit({
            type: 'error',
            reason: unauthorized(error) ? 'auth' : 'codex',
            message: text(error.message) || 'the turn failed',
          });
        } else if (done.status === 'interrupted' && !turn.failed) {
          turn.emit({ type: 'error', reason: 'interrupted', message: 'the turn was interrupted' });
        }
        turn.finish();
        return;
      }
      default:
    }
  }

  /** End a turn early: report once, interrupt it, and let `turn/completed` or the caller close it. */
  #fail(
    /** @type {Conversation} */ conversation,
    /** @type {string} */ reason,
    /** @type {string} */ detail,
  ) {
    const { turn } = conversation;
    if (turn === undefined || turn.failed) return;
    turn.failed = true;
    turn.emit({ type: 'error', reason, message: detail });
    void conversation.child
      .request(
        'turn/interrupt',
        { threadId: conversation.threadId, turnId: turn.id },
        this.options.deadlines.controlMs,
      )
      .catch(() => undefined);
    // An interrupted turn still owes `turn/completed`. A child that never sends it is retired:
    // ending the turn while the thread still runs would let its stragglers reach the next one.
    setTimeout(() => {
      if (conversation.turn === turn) this.#retire(conversation.child);
    }, this.options.deadlines.controlMs).unref();
  }

  /** End a child the bridge no longer trusts: every conversation on it expires first. */
  #retire(/** @type {AppServer} */ child) {
    this.#onExit(child);
    void child.close();
  }

  /**
   * Run one turn, streaming its events through `emit`, and resolve once `done` was emitted.
   *
   * @param {string} message
   * @param {string | undefined} conversationId
   * @param {Emit} emit
   * @param {AbortSignal} signal
   */
  async turn(message, conversationId, emit, signal) {
    const { deadlines, guide } = this.options;
    let conversation =
      conversationId === undefined ? undefined : this.#conversations.get(conversationId);
    if (conversationId !== undefined && conversation === undefined) {
      emit({ type: 'conversation', id: conversationId });
      emit({
        type: 'error',
        reason: 'expired',
        message: 'the conversation is gone; start a new one',
      });
      return;
    }
    if (conversation?.busy === true) {
      emit({ type: 'conversation', id: conversation.id });
      emit({
        type: 'error',
        reason: 'busy',
        message: 'a turn is already running in this conversation',
      });
      return;
    }
    if (conversation !== undefined) conversation.busy = true;
    // `conversation` always leads the stream, so a new one is named before any child wait; it
    // is kept only once its thread exists.
    const id = conversation?.id ?? randomUUID();
    emit({ type: 'conversation', id });
    /** @type {AppServer | undefined} */
    let child;
    try {
      child = await this.#ensure();
      if (conversation === undefined) {
        const started = await child.request(
          'thread/start',
          {
            model: MODEL,
            cwd: this.#cwd,
            sandbox: 'read-only',
            approvalPolicy: 'never',
            ephemeral: true,
            personality: 'none',
            developerInstructions: guide,
            dynamicTools: [PROLOG_TOOL],
          },
          deadlines.controlMs,
        );
        const thread = isRecord(started) && isRecord(started.thread) ? text(started.thread.id) : '';
        if (thread === '') throw new Error('thread/start returned no thread id');
        conversation = {
          id,
          child,
          threadId: thread,
          calls: 0,
          pending: new Map(),
          turn: undefined,
          busy: true,
        };
        this.#conversations.set(conversation.id, conversation);
        this.#threads.set(thread, conversation);
      }
      await this.#run(child, conversation, message, emit, signal);
    } catch (error) {
      const timedOut = error instanceof ControlTimeout;
      emit({
        type: 'error',
        reason: timedOut ? 'timeout' : 'codex',
        message: error instanceof Error ? error.message : String(error),
      });
      // A child that leaves a control request unanswered is not trusted with another turn.
      if (timedOut && child !== undefined && this.#child === child) this.#retire(child);
    } finally {
      if (conversation !== undefined) conversation.busy = false;
    }
  }

  /**
   * @param {AppServer} child
   * @param {Conversation} conversation
   * @param {string} message
   * @param {Emit} emit
   * @param {AbortSignal} signal
   */
  async #run(child, conversation, message, emit, signal) {
    const { deadlines } = this.options;
    /** @type {() => void} */
    let finish = () => undefined;
    const finished = new Promise((resolve) => {
      finish = () => {
        turn.closed = true;
        resolve(undefined);
      };
    });
    // Open before `turn/start` goes out, and named on the response line itself: its first events
    // can share the response's stdout chunk (`AppServer.request` `onResult`).
    /** @type {Turn} */
    const turn = { id: '', emit, finish: () => finish(), failed: false, closed: false };
    conversation.turn = turn;
    /** @param {unknown} started */
    const name = (started) => {
      turn.id = isRecord(started) && isRecord(started.turn) ? text(started.turn.id) : '';
    };
    try {
      await child.request(
        'turn/start',
        {
          threadId: conversation.threadId,
          input: [{ type: 'text', text: message }],
          effort: EFFORT,
          summary: 'none',
          outputSchema: OUTPUT_SCHEMA,
        },
        deadlines.controlMs,
        name,
      );
      if (turn.id === '') throw new Error('turn/start returned no turn id');
    } catch (error) {
      if (conversation.turn === turn) conversation.turn = undefined;
      throw error;
    }
    const timeout = setTimeout(() => {
      this.#fail(conversation, 'timeout', `the turn exceeded ${String(deadlines.turnMs)} ms`);
    }, deadlines.turnMs);
    const disconnect = () => {
      this.#fail(conversation, 'interrupted', 'the page closed the turn');
    };
    signal.addEventListener('abort', disconnect, { once: true });
    if (signal.aborted) disconnect();
    try {
      await finished;
    } finally {
      clearTimeout(timeout);
      signal.removeEventListener('abort', disconnect);
      if (conversation.turn === turn) conversation.turn = undefined;
      this.#settleCalls(conversation, 'the turn ended before the browser answered');
    }
  }

  /**
   * Relay one browser result to its pending call. False = no such open call.
   *
   * @param {string} conversationId
   * @param {string} call
   * @param {string} result
   * @param {boolean} ok
   */
  result(conversationId, call, result, ok) {
    const conversation = this.#conversations.get(conversationId);
    const pending = conversation?.pending.get(call);
    if (conversation === undefined || pending === undefined) return false;
    clearTimeout(pending.timer);
    conversation.pending.delete(call);
    // The call id leads the text, so the model can cite it whatever the page wrote.
    conversation.child.respond(pending.rpcId, {
      contentItems: [{ type: 'inputText', text: `${call}\n${result}` }],
      success: ok,
    });
    return true;
  }

  async close() {
    if (this.#closed) return;
    this.#closed = true;
    const child = this.#child;
    if (child !== undefined) this.#onExit(child);
    await child?.close();
    rmSync(this.#cwd, { recursive: true, force: true });
  }
}

/**
 * Read a form body up to `BODY_MAX`; `undefined` = too large.
 *
 * @param {import('node:http').IncomingMessage} request
 * @returns {Promise<URLSearchParams | undefined>}
 */
const readForm = (request) =>
  new Promise((resolve, reject) => {
    /** @type {Buffer[]} */
    const chunks = [];
    let size = 0;
    // An oversized body is drained, not cut: a server that answers and resets mid-upload hands
    // the client a socket error instead of its 413. Past `DRAIN_MAX` the connection is dropped.
    request.on('data', (/** @type {Buffer} */ chunk) => {
      size += chunk.length;
      if (size > DRAIN_MAX) {
        resolve(undefined);
        request.destroy();
      } else if (size <= BODY_MAX) chunks.push(chunk);
    });
    request.on('end', () => {
      resolve(
        size > BODY_MAX ? undefined : new URLSearchParams(Buffer.concat(chunks).toString('utf8')),
      );
    });
    request.on('error', reject);
  });

/**
 * Start the bridge. Every option is for tests; running the file directly reads env instead.
 *
 * @param {{ port?: number, origins?: string[], codexHome?: string, codexCommand?: string[], deadlines?: Partial<Deadlines> }} [options]
 * @returns {Promise<{ port: number, close(): Promise<void> }>}
 */
export async function startChatServer(options = {}) {
  const command = [...(options.codexCommand ?? ['codex'])];
  const bin = process.env['CHAT_CODEX_BIN'];
  if (bin !== undefined && bin !== '') command[0] = bin;
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- GUIDE is a module constant naming the file beside this one
  const guide = readFileSync(GUIDE, 'utf8');
  const bridge = new Bridge({
    codexCommand: command,
    codexHome: options.codexHome ?? join(homedir(), '.config', 'cnl-ckc-demo', 'codex'),
    guide,
    deadlines: { ...DEADLINES, ...options.deadlines },
  });
  const origins = new Set(options.origins ?? ORIGINS);
  /** @type {Set<string>} */
  let hosts = new Set();
  /** Handlers still writing a response; `close()` lets each end its stream with `done`. */
  /** @type {Set<Promise<void>>} */
  const handling = new Set();

  const server = createServer((request, response) => {
    // The body is discarded unread before the answer goes out: a response that beats its own
    // request body makes the server drop a keep-alive socket the client is about to reuse, and
    // the client's NEXT request then fails with `socket hang up`.
    const refuse = (/** @type {number} */ status) => {
      const answer = () => {
        if (response.headersSent) return;
        response.writeHead(status, { 'content-type': 'text/plain; charset=utf-8' });
        response.end();
      };
      if (request.complete) {
        answer();
        return;
      }
      let size = 0;
      request.on('data', (/** @type {Buffer} */ chunk) => {
        size += chunk.length;
        if (size > DRAIN_MAX) request.destroy();
      });
      request.on('end', answer);
      request.resume();
    };
    if (!hosts.has(request.headers.host ?? '') || !origins.has(request.headers.origin ?? '')) {
      refuse(403);
      return;
    }
    const path = request.url ?? '';
    if (path !== '/api/chat/turn' && path !== '/api/chat/result') {
      refuse(404);
      return;
    }
    if (request.method !== 'POST') {
      refuse(405);
      return;
    }
    const type = (request.headers['content-type'] ?? '').split(';')[0]?.trim().toLowerCase();
    if (type !== 'application/x-www-form-urlencoded') {
      refuse(415);
      return;
    }
    const handled = (async () => {
      const form = await readForm(request);
      if (form === undefined) {
        refuse(413);
        return;
      }
      if (path === '/api/chat/result') {
        const result = form.get('text') ?? '';
        const ok = form.get('ok');
        if (result.length > RESULT_MAX || (ok !== 'true' && ok !== 'false')) {
          refuse(400);
          return;
        }
        const relayed = bridge.result(
          form.get('conversation') ?? '',
          form.get('call') ?? '',
          result,
          ok === 'true',
        );
        refuse(relayed ? 204 : 404);
        return;
      }
      const message = form.get('message') ?? '';
      if (message.length === 0 || message.length > MESSAGE_MAX) {
        refuse(400);
        return;
      }
      const conversation = form.get('conversation');
      response.writeHead(200, {
        'content-type': 'application/x-ndjson',
        'cache-control': 'no-store',
      });
      const aborted = new AbortController();
      response.on('close', () => {
        aborted.abort();
      });
      /** @type {Emit} */
      const emit = (event) => {
        if (!response.writableEnded) response.write(`${JSON.stringify(event)}\n`);
      };
      await bridge.turn(
        message,
        conversation === null || conversation === '' ? undefined : conversation,
        emit,
        aborted.signal,
      );
      emit({ type: 'done' });
      response.end();
    })().catch(() => {
      if (!response.headersSent) refuse(500);
      else response.end();
    });
    handling.add(handled);
    void handled.finally(() => handling.delete(handled));
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(options.port ?? PORT, '127.0.0.1', () => {
      resolve(undefined);
    });
  });
  const address = server.address();
  const port = typeof address === 'object' && address !== null ? address.port : 0;
  hosts = new Set([`127.0.0.1:${String(port)}`, `localhost:${String(port)}`]);
  return {
    port,
    close: async () => {
      const ended = bridge.close();
      await Promise.allSettled([...handling]);
      await ended;
      await new Promise((resolve) => {
        server.close(() => {
          resolve(undefined);
        });
        server.closeAllConnections();
      });
    },
  };
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const env = process.env;
  const home = env['CHAT_CODEX_HOME'] || join(homedir(), '.config', 'cnl-ckc-demo', 'codex');
  const started = await startChatServer({
    port: env['CHAT_PORT'] ? Number(env['CHAT_PORT']) : PORT,
    codexHome: home,
    ...(env['CHAT_ORIGINS'] ? { origins: env['CHAT_ORIGINS'].split(',') } : {}),
  });
  process.stdout.write(
    `chat bridge on http://127.0.0.1:${String(started.port)} (CODEX_HOME=${home})\n`,
  );
  const stop = () => {
    void started.close().then(() => process.exit(0));
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}
