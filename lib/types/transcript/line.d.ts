/** One transcript event, persisted as JSONL. Tolerant parsing: a torn line is
 * skipped and counted, never fatal, never rewritten. */
export interface TranscriptLine {
    v: 1;
    sessionId: string;
    at: string;
    kind: 'user' | 'assistant' | 'tool' | 'system';
    turn?: number;
    who?: string;
    text: string;
}
export type TranscriptLineInput = Omit<TranscriptLine, 'v'>;
export declare function toLine(input: TranscriptLineInput): TranscriptLine;
export declare function parseRecordLine(line: string): TranscriptLine | null;
export declare function parseJsonl(content: string): {
    records: TranscriptLine[];
    skipped: number;
};
//# sourceMappingURL=line.d.ts.map