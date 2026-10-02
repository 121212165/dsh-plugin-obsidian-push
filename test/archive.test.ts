/** Tests for the /archive chain: the pure step helpers plus the real command
 * driving real temp sidecars, a real markdown/ folder and a real vault.
 * @module test/archive */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { archiveVerdict, checkArchive, renderSteps, sessionMatches, shortId } from '../src/archive.ts';
import { makeHarness, mounted, writeTranscript, type Harness } from './harness.ts';

const SESSION = 'session-0f3e9c1a-1234-4abc-9def-000000000001';

test('shortId mirrors the transcript filename convention', () => {
  assert.equal(shortId(SESSION), '0f3e9c1a-123');
  assert.equal(shortId(SESSION, 8), '0f3e9c1a', 'transcript-search cuts at 8; the markdown file at 12');
  assert.equal(shortId('bare-id-without-prefix'), 'bare-id-with');
  assert.equal(shortId(SESSION, 0), '', 'width is a real parameter — never let Array.map pass the index in');
});

test('sessionMatches accepts the full id, a prefix, or the markdown stem', () => {
  assert.equal(sessionMatches(SESSION, 'all'), true);
  assert.equal(sessionMatches(SESSION, ''), true);
  assert.equal(sessionMatches(SESSION, SESSION), true);
  assert.equal(sessionMatches(SESSION, 'session-0f3e'), true);
  assert.equal(sessionMatches(SESSION, '0f3e9c1a-123'), true, 'this is the case /obsidian-push used to miss');
  assert.equal(sessionMatches(SESSION, '0f3e9c1a'), true, 'a transcript-search 8-char stem still resolves');
  assert.equal(sessionMatches(SESSION, 'deadbeef'), false);
});

test('checkArchive finds sessions whose markdown never landed', () => {
  const counts = new Map([[SESSION, 4], ['session-zzzzzzzzzzzz9999', 2]]);
  const flushed = new Set(['0f3e9c1a-123.md', 'unrelated.md']);
  const check = checkArchive(counts, flushed);
  assert.equal(check.sessions, 2);
  assert.equal(check.lines, 6);
  assert.deepEqual(check.missing, ['session-zzzzzzzzzzzz9999']);
  assert.equal(check.truncated, false);
  assert.deepEqual(checkArchive(new Map(), new Set()), { sessions: 0, lines: 0, missing: [], truncated: false });
  const many = new Map(Array.from({ length: 12 }, (_, index) => [`session-${index}`.padEnd(20, '0'), 1]));
  assert.equal(checkArchive(many, new Set(), 8).missing.length, 8);
  assert.equal(checkArchive(many, new Set(), 8).truncated, true);
});

test('renderSteps prints one numbered line per step plus its next action', () => {
  const text = renderSteps('/archive', [
    { title: '归档检查', mark: 'ok', detail: '齐' },
    { title: '推送', mark: 'warn', detail: '写了 2 篇', next: '去看 vault/' },
  ]);
  assert.ok(text.startsWith('/archive:'), text);
  assert.ok(text.includes('① ✓ 归档检查 — 齐'), text);
  assert.ok(text.includes('② △ 推送 — 写了 2 篇'), text);
  assert.ok(text.includes('     ↳ 去看 vault/'), text);
  assert.ok(!text.includes('③'), text);
});

test('the verdict names the stuck step instead of shrugging', () => {
  assert.ok(archiveVerdict({ sessions: 0, lines: 0, missing: [], truncated: false }, 0, 0).includes('链上没有任何数据'));
  assert.ok(archiveVerdict({ sessions: 3, lines: 9, missing: ['a', 'b'], truncated: true }, 1, 0).includes('2+ 个会话没落 markdown'));
  assert.ok(archiveVerdict({ sessions: 3, lines: 9, missing: [], truncated: false }, 2, 1).includes('本轮新推 2 篇'));
  assert.ok(archiveVerdict({ sessions: 3, lines: 9, missing: [], truncated: false }, 0, 3).includes('都已与转录一致'));
});

/** transcript's on-disk evidence that a session was flushed. */
function flush(harness: Harness, sessionId: string): string {
  const dir = join(harness.dataDir, 'markdown');
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `${shortId(sessionId)}.md`);
  writeFileSync(file, `# ${sessionId}\n`, 'utf8');
  return file;
}

const line = (sessionId: string, kind: string, text: string): Record<string, unknown> => ({
  sessionId,
  at: '2026-10-02T09:00:00.000Z',
  kind,
  turn: 1,
  text,
});

async function seeded(): Promise<Harness> {
  const harness = makeHarness();
  writeTranscript(harness, '2026-10', [line(SESSION, 'user', '第一条'), line(SESSION, 'assistant', '答复'), line('session-zzzzzzzzzzzz9999', 'user', '另一个会话')]);
  await harness.apply();
  return harness;
}

test('/archive reports all three steps and pushes what it found', async () => {
  const harness = await seeded();
  const text = harness.command('archive').handler({ rawInput: '' }).text;
  assert.ok(text.includes('① △ transcript 归档检查'), text);
  assert.ok(text.includes('2 个会话 / 3 行'), text);
  assert.ok(text.includes('2 个没有 markdown'), 'neither session has flushed its markdown yet');
  assert.ok(text.includes(`短 id：${shortId(SESSION)} ${shortId('session-zzzzzzzzzzzz9999')}`), `the hint must list real 12-char stems, got: ${text}`);
  assert.ok(text.includes('/transcript-export'), text);
  assert.ok(text.includes('② ✓ Obsidian 推送 — 写入 2 篇'), text);
  assert.ok(text.includes('③ ✓ 检索面'), text);
  assert.ok(text.includes('不存在陈旧索引'), text);
  assert.ok(text.includes('判定：'), text);
});

test('/archive goes quiet-green once every session has flushed its markdown', async () => {
  const harness = await seeded();
  flush(harness, SESSION);
  flush(harness, 'session-zzzzzzzzzzzz9999');
  const first = harness.command('archive').handler({ rawInput: '' }).text;
  assert.ok(first.includes('① ✓ transcript 归档检查'), first);
  assert.ok(first.includes('链是通的'), first);
  const again = harness.command('archive').handler({ rawInput: 'all' }).text;
  assert.ok(again.includes('2 篇内容未变跳过'), again);
  assert.ok(again.includes('都已与转录一致'), again);
});

test('/archive with an empty store and with a bad filter both say what to do', async () => {
  const empty = await mounted();
  const nothing = empty.command('archive').handler({ rawInput: '' });
  assert.equal(nothing.kind, 'error');
  assert.ok(nothing.text.includes('dsh-plugin-transcript'), nothing.text);

  const harness = await seeded();
  const bad = harness.command('archive').handler({ rawInput: 'nomatch' });
  assert.equal(bad.kind, 'success', 'a bad filter is reported as a step, not as a whole-command failure');
  assert.ok(bad.text.includes('② ⚠ Obsidian 推送'), bad.text);
  assert.ok(bad.text.includes('/archive all'), bad.text);
});

test('/obsidian-push accepts a short id now (it used to match nothing)', async () => {
  const harness = await seeded();
  const pushed = harness.command('obsidian-push').handler({ rawInput: shortId(SESSION) });
  assert.equal(pushed.kind, 'success', pushed.text);
  assert.ok(pushed.text.includes('1 写入'), pushed.text);
  const missed = harness.command('obsidian-push').handler({ rawInput: 'deadbeef' });
  assert.equal(missed.kind, 'error');
  assert.ok(missed.text.includes('短 id 也可以'), missed.text);
});
