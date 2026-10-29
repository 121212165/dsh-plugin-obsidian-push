/** Shared assembly-layer harness: a scripted mock dsh context that the real
 * `apply()` wires against, so the /obsidian-push command is exercised over a
 * real temp vault and real temp transcript sidecars. The mock itself lives in
 * @dsh-family/kit; this file adds the temp vault layout and sidecar writer.
 *
 * Config here carries no schemastery defaults — tests pass the full shape
 * apply() expects (vaultDir/subfolder/tags/dataDir).
 * @module test/harness */

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { applyOnce, createMockCtx, tempDir } from '@dsh-family/kit/kit/test-harness';

export interface CapturedCommand {
  name: string;
  description: string;
  input?: { hint?: string };
  handler: (args: { rawInput?: string | undefined }) => { kind: string; text: string };
}

export interface Harness {
  commands: CapturedCommand[];
  /** Temp dir standing in for the Obsidian vault — wiped after tests. */
  vaultDir: string;
  /** Temp dir standing in for ~/.dsh/transcripts — wiped after tests. */
  dataDir: string;
  /** Full config a live host would hand apply(), pointed at the temp dirs. */
  config: Record<string, unknown>;
  /** Mounts the real apply() against this harness once; later calls are no-ops. */
  apply(config?: Record<string, unknown>): Promise<void>;
  command(name: string): CapturedCommand;
}

export function makeHarness(): Harness {
  const mock = createMockCtx<CapturedCommand, never, never>();

  const vaultDir = tempDir('obsidian-push-vault-');
  const dataDir = tempDir('obsidian-push-data-');

  const config = { enabled: true, vaultDir, subfolder: 'dsh-sessions', tags: ['dsh', 'session'], dataDir };

  // apply once per harness — a second call would double-register the command.
  let pending: Record<string, unknown> = {};
  let mounted = false;
  const applied = applyOnce(() =>
    import('../src/plugin.ts').then(({ apply }) =>
      apply(mock.ctx as never, { ...config, ...pending } as never),
    ),
  );

  return {
    commands: mock.commands,
    vaultDir,
    dataDir,
    config,
    apply(overrides: Record<string, unknown> = {}) {
      if (!mounted) {
        mounted = true;
        pending = overrides;
      }
      return applied();
    },
    command: mock.command,
  };
}

/** Write one transcript sidecar (the dsh-plugin-transcript JSONL contract)
 * into the harness dataDir and return its path. */
export function writeTranscript(harness: Harness, month: string, lines: Array<Record<string, unknown>>): string {
  const file = join(harness.dataDir, `transcript-${month}.jsonl`);
  writeFileSync(file, lines.map((line) => JSON.stringify({ v: 1, ...line })).join('\n') + '\n', 'utf8');
  return file;
}

/** Convenience: mount the harness and return it. */
export async function mounted(): Promise<Harness> {
  const harness = makeHarness();
  await harness.apply();
  return harness;
}

/** Fire /obsidian-push on an already-mounted harness, returning the raw result. */
export function fire(harness: Harness, rawInput?: string): { kind: string; text: string } {
  return harness.command('obsidian-push').handler({ rawInput });
}

/** Fire /obsidian-push and unwrap its text, asserting it succeeded. */
export function fireOk(harness: Harness, rawInput?: string): string {
  const result = fire(harness, rawInput);
  if (result.kind !== 'success') throw new Error(`expected success from /obsidian-push, got ${result.kind}: ${result.text}`);
  return result.text;
}
