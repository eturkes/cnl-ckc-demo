import assert from 'node:assert/strict';
import { appendFileSync, readFileSync, readdirSync } from 'node:fs';
import { isAbsolute } from 'node:path';
import { createInterface } from 'node:readline';
import { pathToFileURL } from 'node:url';

export const OUTPUT_SCHEMA = {
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
};
export const FINAL_TEXT =
  '{"segments":[{"text":"日本語 \\n exact bytes","source":"kb","queries":["q1"],"urls":[]}]}';
export const GOAL = 'clinical_recommendation(Doc, Advice)';
export const COMMENTARY = 'Checking the guideline. 日本語';
export const WEB_RESULT = {
  url: 'https://example.test/guideline',
  title: 'Guideline',
  domain: 'example.test',
  snippet: 'Verbatim source excerpt.',
};
export const METHODS = [
  'item/commandExecution/requestApproval',
  'item/fileChange/requestApproval',
  'item/tool/requestUserInput',
  'mcpServer/elicitation/request',
  'item/permissions/requestApproval',
  'item/tool/call',
  'account/chatgptAuthTokens/refresh',
  'attestation/generate',
  'currentTime/read',
  'applyPatchApproval',
  'execCommandApproval',
];

/** @param {unknown} value @returns {Record<string, unknown>} */
function object(value) {
  assert(value !== null && typeof value === 'object' && !Array.isArray(value));
  return /** @type {Record<string, unknown>} */ (value);
}
/** @param {unknown} value @returns {string} */
function text(value) {
  assert.equal(typeof value, 'string');
  return /** @type {string} */ (value);
}
/** @param {Record<string, unknown>} value @param {string[]} keys */
function exactKeys(value, keys) {
  assert.deepEqual(Object.keys(value).sort(), [...keys].sort());
}

/** @typedef {{threadId: string, id: string, mode: string, closed: boolean}} Turn */
/** @typedef {{method: string, turn: Turn, label: string}} Pending */

function run() {
  const config = object(JSON.parse(process.env.FAKE_CODEX_CONFIG ?? '{}'));
  const tracePath = text(config.trace);
  const stall = config.stall;
  /** `linger`: milliseconds a retired fake lives past SIGTERM, still writing its trace. */
  const linger = typeof config.linger === 'number' ? config.linger : 5;
  /** `stall: 'slow-initialize'` answers `initialize` late: a second turn can arrive meanwhile. */
  const slowInitialize = stall === 'slow-initialize';
  /** @param {string} kind @param {unknown} detail */
  function trace(kind, detail) {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- Trace path belongs to the test's disposable directory.
    appendFileSync(tracePath, JSON.stringify({ kind, detail, pid: process.pid }) + '\n');
  }
  /** @param {unknown[]} messages */
  function send(...messages) {
    for (const message of messages) trace('sent', message);
    process.stdout.write(messages.map((message) => JSON.stringify(message) + '\n').join(''));
  }
  /** @param {unknown} id @param {unknown} result */
  const reply = (id, result) => ({ jsonrpc: '2.0', id, result });
  /** @param {string} method @param {unknown} params */
  const note = (method, params) => ({ jsonrpc: '2.0', method, params });
  /** @param {Turn} turn @param {unknown} item */
  const item = (turn, item) =>
    note('item/completed', { threadId: turn.threadId, turnId: turn.id, item });
  /** @param {Turn} turn @param {string} status @param {unknown} [error] */
  const turnValue = (turn, status, error = null) => ({
    id: turn.id,
    rootTurnId: turn.id,
    status,
    error,
    items: [],
    itemsView: 'notLoaded',
    startedAt: null,
    completedAt: null,
    durationMs: null,
  });
  /** @param {Turn} turn @param {string} [status] @param {unknown} [error] */
  function complete(turn, status = 'completed', error = null) {
    turn.closed = true;
    send(note('turn/completed', { threadId: turn.threadId, turn: turnValue(turn, status, error) }));
  }
  /** @param {Turn} turn @param {string} phase @param {string} value */
  function message(turn, phase, value) {
    return item(turn, {
      type: 'agentMessage',
      id: `message-${turn.id}-${phase}`,
      text: value,
      phase,
      memoryCitation: null,
      delivery: null,
      questions: null,
    });
  }
  /** @param {Turn} turn */
  function finish(turn) {
    send(message(turn, 'final_answer', FINAL_TEXT));
    complete(turn);
  }
  /** @param {Turn} turn @param {unknown} results @param {string} query */
  function search(turn, results, query) {
    return item(turn, {
      type: 'webSearch',
      id: `search-${query}`,
      query,
      action: { type: 'search', query, queries: null },
      results,
    });
  }
  let initialized = false;
  let handshake = false;
  let threadCount = 0;
  let turnCount = 0;
  let requestCount = 0;
  const threads = new Set();
  /** @type {Map<string, Turn>} */
  const turns = new Map();
  /** @type {Map<string, Pending>} */
  const pending = new Map();
  /** @param {Turn} turn @param {string} method @param {unknown} params @param {string} [label] */
  function request(turn, method, params, label = method) {
    const id = `server-${++requestCount}`;
    pending.set(id, { method, turn, label });
    return { jsonrpc: '2.0', id, method, params };
  }
  /** @param {Turn} turn @param {Record<string, unknown>} [extra] @param {string} [label] */
  function tool(turn, extra = {}, label = 'tool') {
    return request(
      turn,
      'item/tool/call',
      {
        threadId: turn.threadId,
        turnId: turn.id,
        callId: `call-${requestCount + 1}`,
        namespace: null,
        tool: 'prolog_query',
        arguments: { goal: GOAL },
        ...extra,
      },
      label,
    );
  }
  /** @param {Turn} turn */
  function requests(turn) {
    const shared = {
      threadId: turn.threadId,
      turnId: turn.id,
      itemId: 'item',
      startedAtMs: Date.now(),
    };
    return [
      request(turn, METHODS[0] ?? '', shared),
      request(turn, METHODS[1] ?? '', shared),
      request(turn, METHODS[2] ?? '', { ...shared, questions: [], isBlocking: true }),
      request(turn, METHODS[3] ?? '', {
        threadId: turn.threadId,
        turnId: turn.id,
        serverName: 'fake',
        mode: 'form',
        message: 'Question',
        requestedSchema: { type: 'object', properties: {} },
      }),
      request(turn, METHODS[4] ?? '', { ...shared, cwd: '/', permissions: {} }),
      tool(turn),
      request(turn, METHODS[6] ?? '', { reason: 'unauthorized', previousAccountId: null }),
      request(turn, METHODS[7] ?? '', {}),
      request(turn, METHODS[8] ?? '', { threadId: turn.threadId }),
      request(turn, METHODS[9] ?? '', {
        callId: 'patch',
        conversationId: turn.threadId,
        fileChanges: {},
      }),
      request(turn, METHODS[10] ?? '', {
        callId: 'exec',
        conversationId: turn.threadId,
        command: ['true'],
        cwd: '/',
        parsedCmd: [],
      }),
      request(turn, 'future/request', {}),
      tool(turn, { tool: 'other_tool' }, 'other-tool'),
      tool(turn, { threadId: 'not-a-thread' }, 'other-thread'),
      tool(turn, { turnId: 'not-the-open-turn' }, 'other-turn'),
    ];
  }
  /** @param {Record<string, unknown>} response */
  function response(response) {
    const id = text(response.id);
    const entry = pending.get(id);
    assert(entry, `response for absent/already answered request ${id}`);
    pending.delete(id);
    const { method, turn, label } = entry;
    if (
      ['account/chatgptAuthTokens/refresh', 'attestation/generate', 'future/request'].includes(
        method,
      )
    ) {
      assert.equal(object(response.error).code, -32601);
      assert.equal(typeof object(response.error).message, 'string');
      assert.equal(response.result, undefined);
    } else {
      const result = object(response.result);
      assert.equal(response.error, undefined);
      if (method === 'item/tool/call') {
        exactKeys(result, ['contentItems', 'success']);
        assert.equal(typeof result.success, 'boolean');
        assert(Array.isArray(result.contentItems));
        assert.equal(result.contentItems.length, 1);
        const content = object(result.contentItems[0]);
        exactKeys(content, ['type', 'text']);
        assert.equal(content.type, 'inputText');
        assert(text(content.text).length > 0);
        if (label !== 'tool' || turn.closed) assert.equal(result.success, false);
      } else if (
        ['item/commandExecution/requestApproval', 'item/fileChange/requestApproval'].includes(
          method,
        )
      ) {
        assert.deepEqual(result, { decision: 'decline' });
      } else if (['execCommandApproval', 'applyPatchApproval'].includes(method)) {
        exactKeys(result, ['decision']);
        const decision = object(result.decision);
        exactKeys(decision, ['denied']);
        const denied = object(decision.denied);
        exactKeys(denied, ['rejection']);
        assert(text(denied.rejection).length > 0);
      } else if (method === 'item/permissions/requestApproval') {
        assert.deepEqual(result, { permissions: {} });
      } else if (method === 'item/tool/requestUserInput') {
        assert.deepEqual(result, { answers: {} });
      } else if (method === 'mcpServer/elicitation/request') {
        assert.deepEqual(result, { action: 'decline' });
      } else if (method === 'currentTime/read') {
        exactKeys(result, ['currentTimeAt']);
        assert.equal(typeof result.currentTimeAt, 'number');
        assert(Number.isInteger(result.currentTimeAt));
        assert(Math.abs(Number(result.currentTimeAt) - Math.floor(Date.now() / 1000)) <= 1);
      } else assert.fail(`ungraded response ${method}`);
    }
    trace('validated-response', { id, method, label, response, pending: pending.size });
    if (turn.closed) return;
    if (turn.mode === 'transcript') {
      send(search(turn, [{ type: 'text_result', ref_id: 'r1', ...WEB_RESULT }], 'guideline date'));
      finish(turn);
    } else if (['call', 'stale'].includes(turn.mode)) finish(turn);
    else if (turn.mode === 'requests' && pending.size === 0) {
      complete(turn);
      send(tool(turn, {}, 'closed-turn'));
    } else if (turn.mode === 'call-timeout') complete(turn);
  }
  /** @param {Record<string, unknown>} rpc */
  function receive(rpc) {
    assert.equal(rpc.jsonrpc, '2.0');
    trace('received', rpc);
    if (!('method' in rpc)) return response(rpc);
    const method = text(rpc.method);
    if (method === 'initialized') {
      assert(handshake && !initialized);
      assert.equal(rpc.id, undefined);
      initialized = true;
      return;
    }
    assert(typeof rpc.id === 'string' || typeof rpc.id === 'number');
    const params = object(rpc.params);
    if (method === 'initialize') {
      assert(!handshake);
      const info = object(params.clientInfo);
      assert(text(info.name).length > 0);
      assert(text(info.version).length > 0);
      assert.equal(object(params.capabilities).experimentalApi, true);
      handshake = true;
      const answer = () => {
        send(
          reply(rpc.id, {
            userAgent: 'fake-codex/1',
            codexHome: process.env.CODEX_HOME,
            platformFamily: 'unix',
            platformOs: 'linux',
          }),
        );
      };
      if (slowInitialize) setTimeout(answer, 300);
      else if (stall !== method) answer();
    } else if (method === 'thread/start') {
      assert(initialized);
      exactKeys(params, [
        'model',
        'cwd',
        'sandbox',
        'approvalPolicy',
        'ephemeral',
        'personality',
        'developerInstructions',
        'dynamicTools',
      ]);
      assert.equal(params.model, 'gpt-6.1-sol');
      assert.equal(params.sandbox, 'read-only');
      assert.equal(params.approvalPolicy, 'never');
      assert.equal(params.ephemeral, true);
      assert.equal(params.personality, 'none');
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- The test supplies the repository's fixed guide path.
      assert.equal(params.developerInstructions, readFileSync(text(config.guide), 'utf8'));
      const cwd = text(params.cwd);
      assert(isAbsolute(cwd));
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- The contract requires inspecting the child's isolated directory.
      assert.deepEqual(readdirSync(cwd), []);
      assert(Array.isArray(params.dynamicTools));
      assert.equal(params.dynamicTools.length, 1);
      const dynamic = object(params.dynamicTools[0]);
      assert.equal(dynamic.type, 'function');
      assert.equal(dynamic.name, 'prolog_query');
      assert(text(dynamic.description).length > 0);
      assert.deepEqual(dynamic.inputSchema, {
        type: 'object',
        properties: { goal: { type: 'string' } },
        required: ['goal'],
        additionalProperties: false,
      });
      const id = `thread-${process.pid}-${++threadCount}`;
      threads.add(id);
      if (stall !== method)
        send(reply(rpc.id, { thread: { id, turns: [] }, model: 'gpt-6.1-sol' }));
    } else if (method === 'turn/start') {
      assert(initialized);
      assert('outputSchema' in params, 'turn/start must carry the contract outputSchema');
      exactKeys(params, ['threadId', 'input', 'effort', 'summary', 'outputSchema']);
      const threadId = text(params.threadId);
      assert(threads.has(threadId));
      assert(!turns.get(threadId) || turns.get(threadId)?.closed);
      assert.equal(params.effort, 'medium');
      assert.equal(params.summary, 'none');
      assert.deepEqual(
        params.outputSchema,
        OUTPUT_SCHEMA,
        'turn/start must carry the contract outputSchema',
      );
      assert(Array.isArray(params.input));
      assert.equal(params.input.length, 1);
      const input = object(params.input[0]);
      assert.equal(input.type, 'text');
      const mode = text(input.text);
      const turn = { threadId, id: `turn-${++turnCount}`, mode, closed: false };
      turns.set(threadId, turn);
      if (stall === method) return;
      const started = reply(rpc.id, { turn: turnValue(turn, 'inProgress') });
      // One physical write grades response/event ordering in the bridge's stdout parser.
      if (mode === 'transcript') send(started, message(turn, 'commentary', COMMENTARY), tool(turn));
      else if (mode === 'requests') send(started, ...requests(turn));
      else if (mode === 'searches') {
        send(
          started,
          search(turn, null, 'null-results'),
          search(turn, [null, 17, 'not-object', false, { ...WEB_RESULT }], 'mixed-results'),
        );
        finish(turn);
      } else if (mode === 'stale') {
        const old = { ...turn, id: 'a-retired-turn' };
        send(
          started,
          message(old, 'commentary', 'STALE'),
          message(old, 'final_answer', 'STALE'),
          search(old, [WEB_RESULT], 'STALE'),
          note('turn/completed', { threadId, turn: turnValue(old, 'completed') }),
          tool(old, {}, 'other-turn'),
          tool(turn),
        );
      } else if (
        [
          'call',
          'hold',
          'call-timeout',
          'ignore',
          'exit',
          'unauthorized',
          'auth401',
          'failure',
          'failed',
          'interrupted',
          'complete-open',
        ].includes(mode)
      ) {
        send(started, tool(turn));
        if (mode === 'exit') setImmediate(() => process.exit(17));
        if (['unauthorized', 'auth401', 'failure'].includes(mode))
          send(
            note('error', {
              threadId,
              turnId: turn.id,
              willRetry: mode !== 'failure',
              error: {
                message:
                  mode === 'auth401'
                    ? 'HTTP 401'
                    : mode === 'unauthorized'
                      ? 'unauthorized'
                      : 'inference failed',
                additionalDetails: null,
                codexErrorInfo: null,
              },
            }),
          );
        if (['failed', 'interrupted', 'complete-open'].includes(mode))
          complete(
            turn,
            mode === 'complete-open' ? 'completed' : mode,
            mode === 'failed'
              ? { message: 'turn failed', additionalDetails: null, codexErrorInfo: null }
              : null,
          );
      } else {
        send(started);
        finish(turn);
      }
    } else if (method === 'turn/interrupt') {
      exactKeys(params, ['threadId', 'turnId']);
      const turn = turns.get(text(params.threadId));
      assert(turn && turn.id === params.turnId);
      trace('interrupt', { threadId: turn.threadId, turnId: turn.id });
      if (turn.mode === 'ignore' || stall === method) return;
      send(reply(rpc.id, {}));
      setTimeout(() => complete(turn, 'interrupted'), turn.mode === 'hold' ? 45 : 8);
    } else assert.fail(`unexpected client method ${method}`);
  }
  trace('spawn', { argv: process.argv.slice(2), codexHome: process.env.CODEX_HOME });
  process.on('exit', () => trace('exit', { pending: pending.size }));
  process.on('SIGTERM', () => {
    trace('retired', { pending: pending.size });
    for (const turn of turns.values())
      if (turn.mode === 'ignore') {
        send(
          message(turn, 'commentary', 'RETIRED-STRAGGLER'),
          message(turn, 'final_answer', 'RETIRED-STRAGGLER'),
          tool(turn, {}, 'retired'),
        );
      }
    setTimeout(() => process.exit(0), linger);
  });
  const lines = createInterface({ input: process.stdin });
  lines.on('close', () => process.exit(0));
  lines.on('line', (line) => {
    try {
      receive(object(JSON.parse(line)));
    } catch (error) {
      const detail = error instanceof Error ? error.stack : String(error);
      trace('violation', detail);
      process.stderr.write(`fake-codex contract mismatch: ${detail}\n`);
      process.exit(70);
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) run();
