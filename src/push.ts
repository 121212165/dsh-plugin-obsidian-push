import { createHash } from 'node:crypto';

/** Pure push planning: turn transcript sidecar lines into Obsidian-ready notes.
 * Frontmatter first (Obsidian parses it for search/properties), filename
 * sortable, dedupe by content hash so repeated pushes are idempotent. */

export interface PushRecordLike {
  sessionId: string;
  at: string;
  kind: 'user' | 'assistant' | 'tool' | 'system';
  turn?: number;
  who?: string;
  text: string;
}

export interface PushOptions {
  vaultDir: string; // already expanded
  subfolder: string;
  tags: string[];
  title?: string;
}

export interface PlannedNote {
  path: string;
  content: string;
  hash: string;
  sessionId: string;
  day: string;
}

export function frontmatter(options: PushOptions, sessionId: string, firstAt: string, lastAt: string, entries: number): string {
  const lines = ['---', `title: "${(options.title ?? `Session ${sessionId.slice(0, 8)}`).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`, `date: ${firstAt.slice(0, 10)}`, `session: ${sessionId}`, `entries: ${entries}`, `first: ${firstAt}`, `last: ${lastAt}`, 'tags:'];
  for (const tag of options.tags) lines.push(`  - ${tag}`);
  lines.push('---');
  return lines.join('\n');
}

/** Sortable, collision-free: day + short session id. */
export function noteFilename(sessionId: string, firstAt: string): string {
  return `${firstAt.slice(0, 10)}-${sessionId.slice(0, 8)}.md`;
}

export function planNote(records: PushRecordLike[], options: PushOptions): PlannedNote | null {
  if (!records.length) return null;
  const sorted = [...records].sort((a, b) => (a.at < b.at ? -1 : 1));
  const sessionId = sorted[0]!.sessionId;
  const firstAt = sorted[0]!.at;
  const lastAt = sorted[sorted.length - 1]!.at;
  const body = sorted
    .map((record) => {
      if (record.kind === 'user') return `## 👤 用户\n\n${record.text}`;
      if (record.kind === 'assistant') return `## 🤖 助手${record.who ? ` · ${record.who}` : ''}\n\n${record.text}`;
      if (record.kind === 'tool') return `- 🔧 \`${record.who ?? 'tool'}\`${record.text ? ` — ${record.text.slice(0, 200).replace(/\n/g, ' ')}` : ''}`;
      return `> ℹ️ ${record.text}`;
    })
    .join('\n\n');
  const content = `${frontmatter(options, sessionId, firstAt, lastAt, sorted.length)}\n\n${body}\n`;
  return {
    path: joinVault(options.vaultDir, options.subfolder, noteFilename(sessionId, firstAt)),
    content,
    hash: createHash('sha256').update(content).digest('hex').slice(0, 16),
    sessionId,
    day: firstAt.slice(0, 10),
  };
}

function joinVault(vaultDir: string, subfolder: string, filename: string): string {
  return [vaultDir.replace(/[\\/]+$/, ''), subfolder.replace(/^[\\/]+|[\\/]+$/g, ''), filename].filter(Boolean).join('/');
}

/** Idempotence: skip when the existing note is byte-identical, overwrite when it
 * differs (a re-push after more lines landed should win), report both. */
export type PushDecision = { action: 'write' | 'skip'; reason: string };

export function decide(existingContent: string | null, planned: PlannedNote): PushDecision {
  if (existingContent === null) return { action: 'write', reason: 'new' };
  if (createHash('sha256').update(existingContent).digest('hex').slice(0, 16) === planned.hash) {
    return { action: 'skip', reason: 'identical' };
  }
  return { action: 'write', reason: 'updated' };
}
