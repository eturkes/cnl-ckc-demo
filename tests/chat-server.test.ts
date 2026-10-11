import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { request } from 'node:http';
import { Server } from 'node:net';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { ESLint } from 'eslint';
import ts from 'typescript';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { startChatServer } from '../server/chat.mjs';
import { COMMENTARY, FINAL_TEXT, GOAL, METHODS, WEB_RESULT } from './support/fake-codex.mjs';

type Json = Record<string, unknown>;
type Event = Json & { type: string };
type Trace = { kind: string; detail: Json; pid: number };
type Bridge = { port: number; close(): Promise<void> };
type Options = {
  port?: number;
  origins?: string[];
  codexHome?: string;
  codexCommand?: string[];
  deadlines?: { callMs: number; turnMs: number; controlMs: number };
};
const startBridge = startChatServer as (options: Options) => Promise<Bridge>;
const root = resolve(import.meta.dirname, '..');
const origin = 'http://localhost:5173';
const fake = resolve(root, 'tests/support/fake-codex.mjs');
const guide = resolve(root, 'server/chat-guide.md');
const closed = new WeakSet<Bridge>();
const resources: { bridge: Bridge; dir: string; trace: string; controllers: AbortController[] }[] =
  [];

function object(value: unknown): Json {
  expect(value).not.toBeNull();
  expect(typeof value).toBe('object');
  expect(Array.isArray(value)).toBe(false);
  return value as Json;
}
async function until(predicate: () => boolean, label: string, ms = 700) {
  const start = performance.now();
  while (!predicate()) {
    if (performance.now() - start >= ms) throw new Error(`deadline waiting for ${label}`);
    await delay(2);
  }
}
function rows(path: string): Trace[] {
  return readFileSync(path, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Trace);
}
async function setup(options: Options = {}, stall?: string) {
  mkdirSync(resolve(root, '.scratch'), { recursive: true });
  const dir = mkdtempSync(resolve(root, '.scratch/chat-fake-'));
  const trace = resolve(dir, 'trace.ndjson');
  writeFileSync(trace, '');
  vi.stubEnv('FAKE_CODEX_CONFIG', JSON.stringify({ trace, guide, stall }));
  vi.stubEnv('CHAT_CODEX_BIN', process.execPath);
  const bridge = await startBridge({
    port: 0,
    codexHome: resolve(dir, 'codex-home'),
    codexCommand: ['node', fake],
    deadlines: { callMs: 250, turnMs: 450, controlMs: 100 },
    ...options,
  });
  const resource = { bridge, dir, trace, controllers: [] as AbortController[] };
  resources.push(resource);
  const url = `http://127.0.0.1:${bridge.port}`;
  function post(path: string, data: Record<string, string>, extra: RequestInit = {}) {
    return fetch(url + path, {
      method: 'POST',
      body: new URLSearchParams(data),
      headers: { Origin: origin },
      ...extra,
    });
  }
  async function open(message: string, conversation?: string) {
    const controller = new AbortController();
    resource.controllers.push(controller);
    const response = await post(
      '/api/chat/turn',
      { message, ...(conversation ? { conversation } : {}) },
      { signal: controller.signal },
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toMatch(/^application\/x-ndjson(?:;|$)/);
    const events: Event[] = [];
    const reader = response.body?.getReader();
    expect(reader).toBeDefined();
    let failure: unknown;
    const finished = (async () => {
      const decoder = new TextDecoder();
      let buffer = '';
      if (!reader) throw new Error('missing NDJSON body');
      for (;;) {
        const part = await reader.read();
        if (part.done) break;
        buffer += decoder.decode(part.value, { stream: true });
        for (;;) {
          const newline = buffer.indexOf('\n');
          if (newline < 0) break;
          const line = buffer.slice(0, newline);
          buffer = buffer.slice(newline + 1);
          expect(line.length).toBeGreaterThan(0);
          const event = object(JSON.parse(line));
          expect(typeof event.type).toBe('string');
          events.push(event as Event);
        }
      }
      expect(buffer).toBe('');
    })().catch((error: unknown) => {
      failure = error;
    });
    async function event(type: string, count = 1) {
      await until(
        () =>
          failure !== undefined || events.filter((entry) => entry.type === type).length >= count,
        type,
      );
      if (failure !== undefined)
        throw failure instanceof Error
          ? failure
          : new Error('NDJSON read failed', { cause: failure });
      const found = events.filter((entry) => entry.type === type)[count - 1];
      if (!found) throw new Error(`missing ${type}`);
      return found;
    }
    async function done() {
      await event('done');
      await finished;
      if (failure !== undefined)
        throw failure instanceof Error
          ? failure
          : new Error('NDJSON read failed', { cause: failure });
      expect(events[0]?.type).toBe('conversation');
      expect(events.at(-1)?.type).toBe('done');
      expect(events.filter((entry) => entry.type === 'done')).toHaveLength(1);
      expect(events.filter((entry) => entry.type === 'error').length).toBeLessThanOrEqual(1);
      return events;
    }
    const first = await event('conversation');
    expect(typeof first.id).toBe('string');
    const id = String(first.id);
    return { events, event, done, id, abort: () => controller.abort(), finished };
  }
  return {
    ...resource,
    url,
    open,
    post,
    log: () => rows(trace),
    received: (method: string) =>
      rows(trace).filter((row) => row.kind === 'received' && row.detail.method === method),
    result: (conversation: string, call: string, text = 'Doc = cdc.', ok = 'true') =>
      post('/api/chat/result', { conversation, call, text, ok }),
  };
}

afterEach(async () => {
  try {
    for (const resource of resources.splice(0)) {
      try {
        if (!closed.has(resource.bridge)) await resource.bridge.close();
        const log = rows(resource.trace);
        expect(
          log.filter((row) => row.kind === 'violation'),
          'fake validates every bridge request/response',
        ).toEqual([]);
        const responses = log.filter((row) => row.kind === 'validated-response');
        const ids = responses.map((row) => `${row.pid}:${String(row.detail.id)}`);
        expect(new Set(ids).size, 'each child request answered at most once').toBe(ids.length);
      } finally {
        for (const controller of resource.controllers) controller.abort();
        rmSync(resource.dir, { recursive: true, force: true });
      }
    }
  } finally {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  }
});

function expectError(events: Event[], reason: string) {
  const errors = events.filter((event) => event.type === 'error');
  expect(errors).toHaveLength(1);
  expect(errors[0]?.reason).toBe(reason);
  expect(typeof errors[0]?.message).toBe('string');
}
function toolResponses(log: Trace[]) {
  return log.filter(
    (row) => row.kind === 'validated-response' && row.detail.method === 'item/tool/call',
  );
}
function expectRefused(log: Trace[], count: number) {
  const responses = toolResponses(log);
  expect(responses).toHaveLength(count);
  for (const row of responses)
    expect(object(object(row.detail.response).result).success).toBe(false);
}

// HTTP headers are tested without fetch's restricted Host handling.
function raw(
  port: number,
  headers: Record<string, string>,
  path = '/api/chat/turn',
  method = 'POST',
  body = 'message=x',
) {
  return new Promise<number>((resolveStatus, reject) => {
    const req = request(
      {
        hostname: '127.0.0.1',
        port,
        path,
        method,
        headers: {
          Host: `127.0.0.1:${port}`,
          Origin: origin,
          'Content-Type': 'application/x-www-form-urlencoded',
          ...headers,
        },
      },
      (response) => {
        response.resume();
        response.on('end', () => resolveStatus(response.statusCode ?? 0));
      },
    );
    req.on('error', reject);
    req.end(body);
  });
}

describe('chat-c3 bridge contract', () => {
  it('B1 initializes once, pins start parameters, guide, home and every child flag', async () => {
    const s = await setup();
    await (await s.open('plain')).done();
    const log = s.log();
    const methods = log
      .filter((row) => row.kind === 'received' && 'method' in row.detail)
      .map((row) => row.detail.method);
    expect(methods).toEqual(['initialize', 'initialized', 'thread/start', 'turn/start']);
    const spawn = log.find((row) => row.kind === 'spawn');
    expect(spawn?.detail.codexHome).toBe(resolve(s.dir, 'codex-home'));
    const args = spawn?.detail.argv as string[];
    expect(args[0]).toBe('app-server');
    const settings = args.filter((_, index) => args[index - 1] === '-c');
    expect(settings).toEqual(
      expect.arrayContaining(['web_search="live"', 'project_doc_max_bytes=0', 'mcp_servers={}']),
    );
    for (const feature of [
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
    ]) {
      expect(settings).toContain(`features.${feature}=false`);
    }
    expect(s.received('initialize')).toHaveLength(1);
    expect(s.received('turn/start')).toHaveLength(1);
  });

  it('B2 streams coalesced response and first event in order with verbatim answer bytes', async () => {
    const s = await setup();
    const turn = await s.open('transcript');
    const query = await turn.event('query');
    expect(query).toMatchObject({ call: 'q1', goal: GOAL });
    expect((await s.result(turn.id, 'q1')).status).toBe(204);
    expect(await turn.done()).toEqual([
      { type: 'conversation', id: turn.id },
      { type: 'commentary', text: COMMENTARY },
      { type: 'query', call: 'q1', goal: GOAL },
      {
        type: 'search',
        query: 'guideline date',
        action: { type: 'search', query: 'guideline date', queries: null },
        results: [WEB_RESULT],
      },
      { type: 'answer', text: FINAL_TEXT },
      { type: 'done' },
    ]);
  });

  it('B2 filters null and non-object search results without losing valid objects', async () => {
    const s = await setup();
    const events = await (await s.open('searches')).done();
    expect(events.filter((event) => event.type === 'search').map((event) => event.results)).toEqual(
      [[], [WEB_RESULT]],
    );
    expect(events.find((event) => event.type === 'answer')?.text).toBe(FINAL_TEXT);
  });

  it('B3 binds replies to conversation and call, relays both ok values once with the call prefix', async () => {
    const s = await setup();
    const other = await s.open('plain');
    await other.done();
    const samples = [
      '',
      '日本語\n{"solutions":[]}\u0000',
      ...Array.from({ length: 8 }, (_, seed) =>
        Array.from({ length: seed * 7 + 1 }, (_, index) =>
          String.fromCodePoint(
            [38, 43, 37, 61, 10, 0, 35486, 128512][(seed * 3 + index * 5) % 8] ?? 65,
          ),
        ).join(''),
      ),
    ];
    for (const [index, text] of samples.entries()) {
      const ok = String(index % 2 === 0);
      const turn = await s.open('call');
      await turn.event('query');
      expect((await s.result(other.id, 'q1')).status).toBe(404);
      expect((await s.result(turn.id, 'q1', text, ok)).status).toBe(204);
      expect((await s.result(turn.id, 'q1')).status).toBe(404);
      await turn.done();
      const response = toolResponses(s.log()).at(-1);
      expect(object(response?.detail.response).result).toEqual({
        contentItems: [{ type: 'inputText', text: `q1\n${text}` }],
        success: ok === 'true',
      });
    }
  });

  it('B4 reuses a thread, increments q ids, rejects busy and expired while preserving the active turn', async () => {
    const s = await setup();
    const first = await s.open('call');
    await first.event('query');
    const busy = await s.open('plain', first.id);
    expectError(await busy.done(), 'busy');
    expect((await s.result(first.id, 'q1')).status).toBe(204);
    await first.done();
    const second = await s.open('call', first.id);
    expect(second.id).toBe(first.id);
    expect(await second.event('query')).toMatchObject({ call: 'q2' });
    expect((await s.result(second.id, 'q2')).status).toBe(204);
    await second.done();
    expect(s.received('thread/start')).toHaveLength(1);
    expect(s.received('turn/start')).toHaveLength(2);
    const expired = await s.open('plain', 'absent-conversation');
    expectError(await expired.done(), 'expired');
    expect(s.received('turn/start')).toHaveLength(2);
  });

  it('B5 refuses wrong hosts/origins, method, path, media, byte and field bounds before child requests', async () => {
    const s = await setup();
    await (await s.open('plain')).done();
    const before = s.log().filter((row) => row.kind === 'received').length;
    for (const host of [
      'foreign.test',
      `foreign.test:${s.bridge.port}`,
      `localhost:${s.bridge.port + 1}`,
      `127.0.0.1:${s.bridge.port}.foreign.test`,
    ]) {
      expect(await raw(s.bridge.port, { Host: host })).toBe(403);
    }
    for (const bad of [
      '',
      'null',
      'https://localhost:5173',
      'http://localhost:5173.foreign.test',
      'http://foreign.test',
    ]) {
      expect(await raw(s.bridge.port, { Origin: bad })).toBe(403);
    }
    expect(
      (await fetch(s.url + '/api/chat/turn', { method: 'POST', body: 'message=x' })).status,
    ).toBe(403);
    // A GET carries no body: Node's client sends `end(body)` on a GET unframed, and the stray
    // bytes then break the keep-alive socket the next request reuses.
    expect(await raw(s.bridge.port, {}, '/api/chat/turn', 'GET', '')).toBe(405);
    expect(await raw(s.bridge.port, {}, '/api/chat/missing')).toBe(404);
    expect(
      await raw(
        s.bridge.port,
        { 'Content-Type': 'application/json' },
        undefined,
        undefined,
        '{"message":"x"}',
      ),
    ).toBe(415);
    expect(await raw(s.bridge.port, {}, undefined, undefined, 'x'.repeat(262145))).toBe(413);
    const invalidMessages: Record<string, string>[] = [
      { message: '' },
      { message: 'x'.repeat(4001) },
      {},
    ];
    for (const data of invalidMessages) {
      expect((await s.post('/api/chat/turn', data)).status).toBe(400);
    }
    for (const data of [
      { conversation: 'absent', call: 'q1', text: 'x'.repeat(16385), ok: 'true' },
      { conversation: 'absent', call: 'q1', text: 'x', ok: 'TRUE' },
      { conversation: 'absent', call: 'q1', text: 'x', ok: '1' },
    ])
      expect((await s.post('/api/chat/result', data)).status).toBe(400);
    expect(s.log().filter((row) => row.kind === 'received').length).toBe(before);
  });

  it('B5 admits exact message/body bounds, every demo origin, localhost Host and 16384 Japanese result characters', async () => {
    const s = await setup();
    for (const allowed of [
      origin,
      'http://127.0.0.1:5173',
      'http://localhost:4173',
      'http://127.0.0.1:4173',
    ]) {
      const response = await s.post(
        '/api/chat/turn',
        { message: 'x' },
        { headers: { Origin: allowed } },
      );
      expect(response.status).toBe(200);
      await response.text();
    }
    const maximal = await s.open('x'.repeat(4000));
    await maximal.done();
    const turn = await s.open('call');
    await turn.event('query');
    const japanese = '語'.repeat(16384);
    expect((await s.result(turn.id, 'q1', japanese)).status).toBe(204);
    await turn.done();
    const body = `message=x&padding=${'x'.repeat(262144 - 'message=x&padding='.length)}`;
    expect(Buffer.byteLength(body)).toBe(262144);
    expect(
      await raw(s.bridge.port, { Host: `localhost:${s.bridge.port}` }, undefined, undefined, body),
    ).toBe(200);
  });

  it('B5 replaces default origins with the injected allowlist', async () => {
    const s = await setup({ origins: ['http://localhost:9999'] });
    expect(await raw(s.bridge.port, {})).toBe(403);
    expect(await raw(s.bridge.port, { Origin: 'http://localhost:9999' })).toBe(200);
  });

  it('B6 answers all 11 server methods and unknown requests, refusing other tool/thread/turn and closed turns', async () => {
    const s = await setup();
    const turn = await s.open('requests');
    await turn.event('query');
    expect((await s.result(turn.id, 'q1')).status).toBe(204);
    const events = await turn.done();
    await until(
      () => s.log().filter((row) => row.kind === 'validated-response').length === 16,
      'all 16 server replies',
    );
    const responses = s.log().filter((row) => row.kind === 'validated-response');
    for (const method of METHODS)
      expect(
        responses.some((row) => row.detail.method === method),
        method,
      ).toBe(true);
    expect(events.filter((event) => event.type === 'query')).toHaveLength(1);
    expect(responses.at(-1)?.detail.pending).toBe(0);
    expect((await s.result(turn.id, 'q1')).status).toBe(404);
  });

  it('B7 answers an unanswered call false at callMs and removes its pending result slot', async () => {
    const s = await setup({ deadlines: { callMs: 20, turnMs: 300, controlMs: 100 } });
    const turn = await s.open('call-timeout');
    await turn.event('query');
    await turn.done();
    expectRefused(s.log(), 1);
    expect((await s.result(turn.id, 'q1')).status).toBe(404);
  });

  it('B7 times out, interrupts, retains busy until completed and ends with one error and done', async () => {
    const s = await setup({ deadlines: { callMs: 250, turnMs: 35, controlMs: 100 } });
    const turn = await s.open('hold');
    await turn.event('query');
    await turn.event('error');
    const busy = await s.open('plain', turn.id);
    expectError(await busy.done(), 'busy');
    expectError(await turn.done(), 'timeout');
    expect(s.received('turn/interrupt')).toHaveLength(1);
    expectRefused(s.log(), 1);
    expect((await s.result(turn.id, 'q1')).status).toBe(404);
  });

  it('B7 disconnect interrupts and answers the open call false before another turn', async () => {
    const s = await setup();
    const turn = await s.open('hold');
    await turn.event('query');
    turn.abort();
    await turn.finished;
    await until(
      () => s.received('turn/interrupt').length === 1 && toolResponses(s.log()).length === 1,
      'disconnect cleanup',
    );
    expectRefused(s.log(), 1);
    expect((await s.result(turn.id, 'q1')).status).toBe(404);
  });

  it('B7 retires a child ignoring interrupt and B8 excludes its stragglers after respawn', async () => {
    // controlMs also bounds the respawned child's `initialize`, which includes starting Node.
    const s = await setup({ deadlines: { callMs: 200, turnMs: 25, controlMs: 150 } });
    const turn = await s.open('ignore');
    await turn.event('query');
    const start = performance.now();
    expectError(await turn.done(), 'timeout');
    expect(performance.now() - start).toBeLessThan(300);
    expectRefused(s.log(), 1);
    expect((await s.result(turn.id, 'q1')).status).toBe(404);
    const next = await s.open('plain');
    const events = await next.done();
    expect(next.id).not.toBe(turn.id);
    expect(events).toEqual([
      { type: 'conversation', id: next.id },
      { type: 'answer', text: FINAL_TEXT },
      { type: 'done' },
    ]);
    expect(s.log().filter((row) => row.kind === 'spawn')).toHaveLength(2);
    expectError(await (await s.open('plain', turn.id)).done(), 'expired');
  });

  it.each(['initialize', 'thread/start', 'turn/start'])(
    'B7 bounds unanswered %s control waits',
    async (stall) => {
      const s = await setup({ deadlines: { callMs: 250, turnMs: 350, controlMs: 25 } }, stall);
      const started = performance.now();
      const turn = await s.open('plain');
      expectError(await turn.done(), 'timeout');
      expect(performance.now() - started).toBeLessThan(250);
    },
  );

  it('B7 close answers pending calls false, ends streams and stops the child', async () => {
    const s = await setup();
    const turn = await s.open('hold');
    await turn.event('query');
    await s.bridge.close();
    closed.add(s.bridge);
    await turn.done();
    await until(() => s.log().some((row) => row.kind === 'exit'), 'child exit');
    expectRefused(s.log(), 1);
  });

  it.each(['complete-open', 'failed', 'interrupted', 'failure'])(
    'B7 cleans pending calls on %s with one terminal error at most',
    async (mode) => {
      const s = await setup();
      const turn = await s.open(mode);
      const events = await turn.done();
      await until(() => toolResponses(s.log()).length === 1, 'terminal call refusal');
      expectRefused(s.log(), 1);
      if (mode !== 'complete-open')
        expectError(events, mode === 'interrupted' ? 'interrupted' : 'codex');
      else expect(events.some((event) => event.type === 'error')).toBe(false);
      expect((await s.result(turn.id, 'q1')).status).toBe(404);
    },
  );

  it('B8 child exit ends the active turn, discards pending calls and respawns once with old conversations expired', async () => {
    const s = await setup();
    const turn = await s.open('exit');
    expectError(await turn.done(), 'codex');
    expect((await s.result(turn.id, 'q1')).status).toBe(404);
    const next = await s.open('plain');
    await next.done();
    expect(next.id).not.toBe(turn.id);
    expect(s.log().filter((row) => row.kind === 'spawn')).toHaveLength(2);
    expectError(await (await s.open('plain', turn.id)).done(), 'expired');
  });

  it.each(['unauthorized', 'auth401'])(
    'B8 classifies %s before retry ends, interrupts and emits one auth error',
    async (mode) => {
      const s = await setup();
      const turn = await s.open(mode);
      await turn.event('error');
      expectError(await turn.done(), 'auth');
      expect(s.received('turn/interrupt')).toHaveLength(1);
      expectRefused(s.log(), 1);
      expect((await s.result(turn.id, 'q1')).status).toBe(404);
    },
  );

  it('B8 drops commentary, search, answer, completion and calls belonging to another turn', async () => {
    const s = await setup();
    const turn = await s.open('stale');
    expect(await turn.event('query')).toMatchObject({ call: 'q1' });
    expect((await s.result(turn.id, 'q1')).status).toBe(204);
    expect(await turn.done()).toEqual([
      { type: 'conversation', id: turn.id },
      { type: 'query', call: 'q1', goal: GOAL },
      { type: 'answer', text: FINAL_TEXT },
      { type: 'done' },
    ]);
    expect(toolResponses(s.log())).toHaveLength(2);
  });

  it('B9 binds only IPv4 loopback and includes server modules in the real lint/typecheck graph', async () => {
    const listen = vi.spyOn(Server.prototype, 'listen');
    await setup();
    expect(listen).toHaveBeenCalledOnce();
    const args = listen.mock.calls[0] as unknown[];
    const address =
      args.find((value) => value === '127.0.0.1') ??
      args
        .map((value) =>
          value !== null && typeof value === 'object' ? object(value).host : undefined,
        )
        .find(Boolean);
    expect(address).toBe('127.0.0.1');
    const serverPath = resolve(root, 'server/chat.mjs');
    expect(await new ESLint({ cwd: root }).isPathIgnored(serverPath)).toBe(false);
    const config = ts.readConfigFile(resolve(root, 'tsconfig.json'), (path) =>
      ts.sys.readFile(path),
    );
    expect(config.error).toBeUndefined();
    const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
    expect(parsed.options.allowJs).toBe(true);
    expect(parsed.options.checkJs).toBe(true);
    expect(parsed.fileNames).toContain(serverPath);
    const packageJson = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as {
      scripts: { lint: string; check: string };
    };
    expect(packageJson.scripts.lint).toMatch(/eslint/);
    expect(packageJson.scripts.check).toMatch(/svelte-check|tsc/);
  });
});
