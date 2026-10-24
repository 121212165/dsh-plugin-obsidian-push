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
import { type PushRecordLike } from './push.ts';
export declare function shortId(sessionId: string, width?: number): string;
/** Accept the full id, any prefix of it, or the markdown stem — the old
 * `startsWith(argument)` over full ids made a pasted short id match nothing. */
export declare function sessionMatches(sessionId: string, argument: string): boolean;
export interface ArchiveCheck {
    sessions: number;
    lines: number;
    /** sessions with transcript lines but no flushed markdown file */
    missing: string[];
    truncated: boolean;
}
export declare function checkArchive(bySession: Map<string, number>, markdownFiles: Set<string>, limit?: number): ArchiveCheck;
export interface StepOutcome {
    title: string;
    mark: 'ok' | 'warn' | 'bad';
    detail: string;
    /** what the user should do next, if anything */
    next?: string;
}
export declare function renderSteps(name: string, steps: StepOutcome[]): string;
/** One glance: is anything stuck anywhere in the chain? */
export declare function archiveVerdict(check: ArchiveCheck, written: number, skipped: number): string;
/** The session's display title for the MOC: first user message, whitespace
 * collapsed, capped at 40 chars — the same cap deriveTitle uses upstream. */
export declare function sessionTitle(lines: PushRecordLike[], max?: number): string;
export interface IndexRow {
    date: string;
    title: string;
    short: string;
    file: string;
}
/** One row per session for the MOC, newest first. The file name must come from
 * push.ts's own noteFilename — a hand-rolled copy here is how the index starts
 * pointing at notes that were never written. */
export declare function indexRows(groups: Map<string, PushRecordLike[]>): IndexRow[];
/** The MOC body written to `<vault>/<subfolder>/Index.md` after a push. */
export declare function buildIndex(groups: Map<string, PushRecordLike[]>, subfolder: string): string;
//# sourceMappingURL=archive.d.ts.map