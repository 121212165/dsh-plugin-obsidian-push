/** Shared assembly-layer harness: a scripted mock dsh context that the real
 * `apply()` wires against, so the /obsidian-push command is exercised over a
 * real temp vault and real temp transcript sidecars — the wire coverage the
 * family audit found missing everywhere. Pattern adopted from dsh-auto-review's
 * mountHarness (222★), rebuilt on node:test after dsh-plugin-task-forge (the
 * family's first port).
 *
 * obsidian-push only touches ctx.logger / ctx.commands, so that is all the
 * mock provides. Config here carries no schemastery defaults — tests pass the
 * full shape apply() expects (vaultDir/subfolder/tags/dataDir).
 * @module test/harness */

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after } from 'node:test';

export interface CapturedCommand {
  name: string;
  description: string;
  input?: { hint?: string };
  handler: (args: { rawInput?: string }) => { kind: string; text: string };
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
  const commands: CapturedCommand[] = [];

  const ctx = {
    logger(_name: string) {
      return { info() {}, warn() {} };
    },
    commands: {
      register(definition: CapturedCommand) {
        commands.push(definition);
      },
    },
  };

  const vaultDir = mkdtempSync(join(tmpdir(), 'obsidian-push-vault-'));
  const dataDir = mkdtempSync(join(tmpdir(), 'obsidian-push-data-'));
  after(() => {
    rmSync(vaultDir, { recursive: true, force: true });
    rmSync(dataDir, { recursive: true, force: true });
  });

  const config = { enabled: true, vaultDir, subfolder: 'dsh-sessions', tags: ['dsh', 'session'], dataDir };

  // apply once per harness — a second call would double-register the command.
  let applied: Promise<void> | null = null;

  const harness: Harness = {
    commands,
    vaultDir,
    dataDir,
    config,
    apply(overrides: Record<string, unknown> = {}) {
      applied ??= import('../src/plugin.ts').then(({ apply }) => apply(ctx as never, { ...config, ...overrides } as never));
      return applied;
    },
    command(name: string): CapturedCommand {
      const found = commands.find((candidate) => candidate.name === name);
      if (!found) throw new Error(`command ${name} was never registered`);
      return found;
    },
  };
  return harness;
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
