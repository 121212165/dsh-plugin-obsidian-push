import assert from 'node:assert/strict';
import { test } from 'node:test';
import { planNote, decide, frontmatter, noteFilename, type PushRecordLike } from '../src/push.ts';

const record = (over: Partial<PushRecordLike>): PushRecordLike =>
  ({ sessionId: 'abcdef1234567890', at: '2026-09-28T01:00:00.000Z', kind: 'user', text: 'hello', ...over });

const options = { vaultDir: '/v', subfolder: 'dsh-sessions', tags: ['dsh', 'session'] };

test('planned note has frontmatter, sortable filename and ordered body', () => {
  const note = planNote(
    [record({}), record({ kind: 'assistant', at: '2026-09-28T01:05:00.000Z', text: 'reply', who: 'deepseek-v4-pro' }), record({ at: '2026-09-28T00:30:00.000Z', text: 'earlier' })],
    { ...options, title: '写作' },
  )!;
  assert.ok(note.content.startsWith('---\ntitle: "写作"\ndate: 2026-09-28'));
  assert.ok(note.content.includes('session: abcdef1234567890'));
  assert.ok(note.content.includes('  - dsh'));
  assert.ok(note.path.endsWith('/dsh-sessions/2026-09-28-abcdef12.md'));
  const body = note.content.split('---\n').pop()!;
  assert.ok(body.indexOf('earlier') < body.indexOf('hello')); // sorted by time
  assert.ok(body.includes('## 🤖 助手 · deepseek-v4-pro'));
});

test('frontmatter escapes double quotes in titles', () => {
  const fm = frontmatter({ ...options, title: '说" hi' }, 's', '2026-09-28T00:00:00.000Z', '2026-09-28T00:00:00.000Z', 1);
  assert.ok(fm.includes('title: "说\\" hi"'));
});

test('empty records plan nothing', () => {
  assert.equal(planNote([], options), null);
});

test('dedupe: identical content skips, changed content overwrites', () => {
  const note = planNote([record({})], options)!;
  assert.deepEqual(decide(null, note), { action: 'write', reason: 'new' });
  assert.deepEqual(decide(note.content, note), { action: 'skip', reason: 'identical' });
  const updated = planNote([record({}), record({ at: '2026-09-28T02:00:00.000Z', text: 'more' })], options)!;
  assert.deepEqual(decide(note.content, updated), { action: 'write', reason: 'updated' });
});

test('filename is day + short session id', () => {
  assert.equal(noteFilename('abcdef1234567890', '2026-09-28T01:00:00.000Z'), '2026-09-28-abcdef12.md');
});
