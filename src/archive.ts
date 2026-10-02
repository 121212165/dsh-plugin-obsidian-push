/** Pure helpers behind `/archive` — the three-step chain 归档检查 → 推送 → 检索面.
 *
 * obsidian-push is the chain owner because it is the only one of the three that
 * both reads transcripts and writes notes. The other two plugins are reached
 * through their on-disk contracts (mirrored here, never imported):
 *   - dsh-plugin-transcript flushes each disposed session to
 *     `<dataDir>/markdown/<short12>.md`, where short12 drops the `session-`
 *     prefix and takes 12 characters;
 *   - dsh-plugin-transcript-search rebuilds its index from the same JSONL on
 *     every query, so there is no index file to "refresh" — /archive says so
 *     instead of pretending to do a step that does not exist.
 */

export function shortId(sessionId: string, width = 12): string {
  return sessionId.replace(/^session-/, '').slice(0, width);
}

/** Accept the full id, any prefix of it, or the markdown stem — the old
 * `startsWith(argument)` over full ids made a pasted short id match nothing. */
export function sessionMatches(sessionId: string, argument: string): boolean {
  if (!argument || argument === 'all') return true;
  if (sessionId === argument || sessionId.startsWith(argument)) return true;
  const short = shortId(sessionId);
  return short === argument || short.startsWith(argument) || argument.startsWith(short);
}

export interface ArchiveCheck {
  sessions: number;
  lines: number;
  /** sessions with transcript lines but no flushed markdown file */
  missing: string[];
  truncated: boolean;
}

export function checkArchive(bySession: Map<string, number>, markdownFiles: Set<string>, limit = 8): ArchiveCheck {
  const missing: string[] = [];
  let lines = 0;
  for (const [sessionId, count] of bySession) {
    lines += count;
    if (!markdownFiles.has(`${shortId(sessionId)}.md`)) missing.push(sessionId);
  }
  return { sessions: bySession.size, lines, missing: missing.slice(0, limit), truncated: missing.length > limit, };
}

export interface StepOutcome {
  title: string;
  mark: 'ok' | 'warn' | 'bad';
  detail: string;
  /** what the user should do next, if anything */
  next?: string;
}

const MARKS = { ok: '✓', warn: '△', bad: '⚠' } as const;

export function renderSteps(name: string, steps: StepOutcome[]): string {
  const lines = [`${name}:`];
  steps.forEach((step, index) => {
    lines.push(`  ${'①②③④⑤'[index] ?? '·'} ${MARKS[step.mark]} ${step.title} — ${step.detail}`);
    if (step.next) lines.push(`     ↳ ${step.next}`);
  });
  return lines.join('\n');
}

/** One glance: is anything stuck anywhere in the chain? */
export function archiveVerdict(check: ArchiveCheck, written: number, skipped: number): string {
  if (check.sessions === 0) return '链上没有任何数据：dsh-plugin-transcript 还没归档过会话。';
  if (check.missing.length) return `有 ${check.missing.length}${check.truncated ? '+' : ''} 个会话没落 markdown——去补，别急着推送。`;
  if (written) return `本轮新推 ${written} 篇笔记${skipped ? `（${skipped} 篇内容未变，跳过）` : ''}，链是通的。`;
  return '推送面干净：所有笔记都已与转录一致。';
}
