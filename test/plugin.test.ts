/** Assembly-layer integration tests: the real apply() wired against a scripted
 * mock context, driving /obsidian-push over a real temp vault and real temp
 * transcript sidecars (the dsh-plugin-transcript JSONL contract). This is the
 * wire coverage the family audit flagged as missing (plugin.ts had zero
 * tests). Pure-layer contracts live in the sibling push suite.
 * @module test/plugin.test */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { fire, fireOk, makeHarness, mounted, writeTranscript } from './harness.ts';

const SESSION_A = 'session-68f7b972-c234-42b4-ba9a-539564cb2940';
const SESSION_B = 'session-1a2b3c4d-5e6f-4a1b-8c9d-000000000001';
const NOTE_A = '2026-09-28-68f7b972-c23.md';

/** Mount a harness and write one sidecar holding two sessions. */
async function seeded(): Promise<ReturnType<typeof makeHarness>> {
  const harness = await mounted();
  writeTranscript(harness, '2026-09', [
    { sessionId: SESSION_A, at: '2026-09-28T01:00:00.000Z', kind: 'user', text: '帮我起草周报' },
    { sessionId: SESSION_A, at: '2026-09-28T01:05:00.000Z', kind: 'assistant', who: 'deepseek-v4-pro', text: '好的，这是草稿' },
    { sessionId: SESSION_B, at: '2026-09-28T02:00:00.000Z', kind: 'user', text: '另一场会话' },
  ]);
  return harness;
}

function notePath(harness: ReturnType<typeof makeHarness>, filename: string): string {
  // plugin.ts writes via the vault-style '/' join; node handles the mixed
  // separators on win32, so reading back through join() sees the same file.
  return join(harness.vaultDir, 'dsh-sessions', filename);
}

test('disabled by config — or no discoverable vault — mounts nothing', async () => {
  const off = makeHarness();
  await off.apply({ enabled: false });
  assert.equal(off.commands.length, 0);

  // with no discoverable vault, commands still register — invoking them
  // returns the actionable two-step fix instead of a silent no-op
  const savedAppData = process.env.APPDATA;
  process.env.APPDATA = join(mkdtempSync(join(tmpdir(), 'obsidian-empty-')));
  try {
    const unconfigured = makeHarness();
    await unconfigured.apply({ vaultDir: '' });
    assert.equal(unconfigured.commands.length, 3);
    const result = unconfigured.command('obsidian-push').handler({ rawInput: 'all' });
    assert.equal(result.kind, 'error');
    assert.ok(result.text.includes('打开 Obsidian'), result.text);
  } finally {
    process.env.APPDATA = savedAppData;
  }
});

test("zero-config: empty vaultDir auto-discovers the vault from Obsidian's registry", async () => {
  const fake = mkdtempSync(join(tmpdir(), 'obsidian-fixture-'));
  const vaultRoot = join(fake, 'My Vault');
  mkdirSync(join(fake, 'obsidian'), { recursive: true });
  writeFileSync(join(fake, 'obsidian', 'obsidian.json'), JSON.stringify({ vaults: { a: { path: vaultRoot, open: true, ts: 1 } } }));
  mkdirSync(vaultRoot, { recursive: true });
  const savedAppData = process.env.APPDATA;
  process.env.APPDATA = fake;
  try {
    const harness = makeHarness();
    await harness.apply({ vaultDir: '' });
    assert.equal(harness.commands.length, 3); // push + push-file + /archive, mounted without any hand-typed path
    writeTranscript(harness, '2026-09', [
      { sessionId: 'session-zeroconf01', at: '2026-09-28T01:00:00.000Z', kind: 'user', text: '零配置冒烟' },
      { sessionId: 'session-zeroconf01', at: '2026-09-28T01:05:00.000Z', kind: 'assistant', who: 'deepseek-v4-pro', text: '完成' },
    ]);
    const result = harness.command('obsidian-push').handler({ rawInput: 'all' });
    assert.equal(result.kind, 'success', result.text);
    assert.ok(existsSync(join(vaultRoot, 'dsh-sessions')), 'note landed in the discovered vault');
  } finally {
    process.env.APPDATA = savedAppData;
  }
});
test('apply wires the push command and the chain command, each with a hint', async () => {
  const harness = await mounted();
  assert.deepEqual(harness.commands.map((command) => command.name), ['obsidian-push', 'obsidian-push-file', 'archive']);
  const command = harness.command('obsidian-push');
  assert.match(command.description, /Obsidian/);
  assert.match(command.input?.hint ?? '', /sessionId/);
  assert.match(harness.command('archive').description, /检查.*推送.*检索.*索引/s, '/archive describes all four steps it walks');
});

test('with no archived sidecars the push fails loud pointing at the data dir', async () => {
  const harness = await mounted();
  const result = fire(harness);
  assert.equal(result.kind, 'error');
  assert.ok(result.text.includes('还没有归档转录'), result.text);
  assert.ok(result.text.includes(harness.dataDir), result.text);
});

test('push all lands one note per session under the vault subfolder', async () => {
  const harness = await seeded();
  const text = fireOk(harness, 'all');

  assert.ok(text.includes('2 写入 / 0 跳过'), text);
  const noteA = notePath(harness, NOTE_A);
  assert.ok(existsSync(noteA), `missing ${noteA}`);
  const content = readFileSync(noteA, 'utf8');
  assert.ok(content.startsWith('---\n'), 'frontmatter first');
  assert.ok(content.includes('session: ' + SESSION_A), content);
  assert.ok(content.includes('  - dsh'), content);
  assert.ok(content.includes('帮我起草周报'), content);
  assert.ok(content.includes('## 🤖 助手 · deepseek-v4-pro'), content);
  assert.ok(existsSync(notePath(harness, '2026-09-28-1a2b3c4d-5e6.md')));
});

test('push filters by session-id prefix and errors when nothing matches', async () => {
  const harness = await seeded();
  const text = fireOk(harness, 'session-68f7');
  assert.ok(text.includes('1 写入 / 0 跳过'), text);
  assert.ok(existsSync(notePath(harness, NOTE_A)));
  assert.ok(!existsSync(notePath(harness, '2026-09-28-1a2b3c4d-5e6.md')));

  const miss = fire(harness, 'deadbeef');
  assert.equal(miss.kind, 'error');
  assert.ok(miss.text.includes('没有匹配'), miss.text);
});

test('re-pushing unchanged content is a no-op: everything skips, bytes identical', async () => {
  const harness = await seeded();
  fireOk(harness, 'all');
  const noteA = notePath(harness, NOTE_A);
  const before = readFileSync(noteA, 'utf8');

  const again = fireOk(harness, 'all');
  assert.ok(again.includes('0 写入 / 2 跳过'), again);
  assert.equal(readFileSync(noteA, 'utf8'), before);
});

test('new sidecar lines win on re-push: note is updated, not skipped', async () => {
  const harness = await seeded();
  fireOk(harness, 'all');
  writeTranscript(harness, '2026-09', [
    { sessionId: SESSION_A, at: '2026-09-28T01:00:00.000Z', kind: 'user', text: '帮我起草周报' },
    { sessionId: SESSION_A, at: '2026-09-28T01:05:00.000Z', kind: 'assistant', who: 'deepseek-v4-pro', text: '好的，这是草稿' },
    { sessionId: SESSION_A, at: '2026-09-28T01:10:00.000Z', kind: 'user', text: '结尾再加一段总结' },
    { sessionId: SESSION_B, at: '2026-09-28T02:00:00.000Z', kind: 'user', text: '另一场会话' },
  ]);

  const text = fireOk(harness, 'all');
  assert.ok(text.includes('updated'), text);
  // session A changed (write) while session B is untouched (skip)
  assert.ok(text.includes('1 写入 / 1 跳过'), text);
  const content = readFileSync(notePath(harness, NOTE_A), 'utf8');
  assert.ok(content.includes('结尾再加一段总结'), content);
  assert.ok(content.includes('entries: 3'), content);
});
