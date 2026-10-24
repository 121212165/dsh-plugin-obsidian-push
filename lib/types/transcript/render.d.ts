/**
 * Pure transcript model: tolerant text extraction from session event payloads
 * and markdown rendering. No dsh imports — the host wiring feeds it whatever
 * the events contain, so a payload shape change degrades to "less text"
 * instead of a crash.
 */
export type TranscriptKind = 'user' | 'assistant' | 'tool' | 'system';
export interface TranscriptEntry {
    kind: TranscriptKind;
    at: string;
    turn?: number;
    /** display name: model id for assistant, tool name for tool entries */
    who?: string;
    text: string;
}
/** dsh content blocks: {type:'text'|'thinking'|…, text?…}. Unknown blocks are
 * skipped, text blocks joined in order. */
export declare function textFromContent(content: unknown): string;
/** Assistant stream frames. Two shapes exist in the wild (both observed in
 * dsh-token-telemetry's verified stream handling): flat chunks
 * {type:'text-delta'|'reasoning-delta',text} and grouped frames
 * {type:'text-chunks'|'reasoning-chunks',texts[],dt[]}. Unknown shapes yield
 * empty strings instead of throwing. */
export declare function textFromStream(stream: unknown): {
    body: string;
    reasoning: string;
};
/** Assistant stream chunks ({type:'text-delta',text} | {type:'reasoning-delta',text}).
 * Reasoning goes into the transcript as a collapsible block, never mixed into body text. */
export declare function textFromStreamChunks(chunks: unknown): {
    body: string;
    reasoning: string;
};
export declare function renderTranscript(entries: TranscriptEntry[], meta: {
    sessionId: string;
    title?: string;
}): string;
export declare function countWords(text: string): {
    chars: number;
    cjk: number;
};
//# sourceMappingURL=render.d.ts.map