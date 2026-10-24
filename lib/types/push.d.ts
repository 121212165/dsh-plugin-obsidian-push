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
    vaultDir: string;
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
export declare function frontmatter(options: PushOptions, sessionId: string, firstAt: string, lastAt: string, entries: number): string;
/** Sortable, collision-free: day + short session id. The harness prefixes
 * every id with 'session-' — strip it and keep 12 chars of the uuid part,
 * matching html-report (8 chars of uuid collided same-day). */
export declare function shortSessionId(sessionId: string): string;
export declare function noteFilename(sessionId: string, firstAt: string): string;
export declare function planNote(records: PushRecordLike[], options: PushOptions): PlannedNote | null;
/** Idempotence: skip when the existing note is byte-identical, overwrite when it
 * differs (a re-push after more lines landed should win), report both. */
export type PushDecision = {
    action: 'write' | 'skip';
    reason: string;
};
export declare function decide(existingContent: string | null, planned: PlannedNote): PushDecision;
/** Single-file push decision (used by /obsidian-push-file): the file goes in
 * verbatim — no frontmatter, no hash rewriting — so the idempotence check is a
 * plain content comparison. */
export declare function decideFile(existingContent: string | null, content: string): {
    action: 'skip' | 'write';
    reason: string;
};
//# sourceMappingURL=push.d.ts.map