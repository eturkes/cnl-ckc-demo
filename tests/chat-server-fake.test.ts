import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { expect, it } from 'vitest';
import { OUTPUT_SCHEMA } from './support/fake-codex.mjs';

it('B1 B2 fake control accepts the contract schema and refuses its omission before any turn event', async () => {
  const root = resolve(import.meta.dirname, '..');
  mkdirSync(resolve(root, '.scratch'), { recursive: true });
  const dir = mkdtempSync(resolve(root, '.scratch/fake-control-'));
  const cwd = resolve(dir, 'empty');
  mkdirSync(cwd);
  const guide = resolve(root, '.agent/contracts/chat-c3.md');
  try {
    for (const includeSchema of [true, false]) {
      const trace = resolve(dir, `trace-${String(includeSchema)}`);
      const child = spawn(
        process.execPath,
        [resolve(root, 'tests/support/fake-codex.mjs'), 'app-server'],
        {
          env: { ...process.env, FAKE_CODEX_CONFIG: JSON.stringify({ trace, guide }) },
          stdio: ['pipe', 'pipe', 'pipe'],
        },
      );
      const exit = once(child, 'exit');
      let stdout = '';
      let stderr = '';
      child.stdout.setEncoding('utf8').on('data', (text: string) => {
        stdout += text;
      });
      child.stderr.setEncoding('utf8').on('data', (text: string) => {
        stderr += text;
      });
      const write = (message: Record<string, unknown>) =>
        child.stdin.write(JSON.stringify({ jsonrpc: '2.0', ...message }) + '\n');
      write({
        id: 1,
        method: 'initialize',
        params: {
          clientInfo: { name: 'contract-control', version: '1' },
          capabilities: { experimentalApi: true },
        },
      });
      write({ method: 'initialized' });
      write({
        id: 2,
        method: 'thread/start',
        params: {
          model: 'gpt-6.1-sol',
          cwd,
          sandbox: 'read-only',
          approvalPolicy: 'never',
          ephemeral: true,
          personality: 'none',
          developerInstructions: readFileSync(guide, 'utf8'),
          dynamicTools: [
            {
              type: 'function',
              name: 'prolog_query',
              description: 'Query the browser engine.',
              inputSchema: {
                type: 'object',
                properties: { goal: { type: 'string' } },
                required: ['goal'],
                additionalProperties: false,
              },
            },
          ],
        },
      });
      try {
        const start = performance.now();
        // A precondition wait, not a bound under test: the fake's Node process can take seconds
        // to start under the gate's full-suite load.
        while (!stdout.includes(`thread-${String(child.pid)}-1`)) {
          if (performance.now() - start > 4000) throw new Error(`fake handshake failed: ${stderr}`);
          await delay(2);
        }
        write({
          id: 3,
          method: 'turn/start',
          params: {
            threadId: `thread-${String(child.pid)}-1`,
            input: [{ type: 'text', text: 'plain' }],
            effort: 'medium',
            summary: 'none',
            ...(includeSchema ? { outputSchema: OUTPUT_SCHEMA } : {}),
          },
        });
        if (includeSchema) {
          while (!stdout.includes('turn/completed')) {
            if (performance.now() - start > 500) throw new Error(`fake turn failed: ${stderr}`);
            await delay(2);
          }
          child.stdin.end();
        }
        const result = await exit;
        expect(result[0]).toBe(includeSchema ? 0 : 70);
        expect(stdout.includes('turn/completed')).toBe(includeSchema);
        if (includeSchema) expect(stderr).toBe('');
        else expect(stderr).toContain('turn/start must carry the contract outputSchema');
      } finally {
        if (child.exitCode === null && child.signalCode === null) {
          child.kill('SIGKILL');
          await exit;
        }
      }
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
