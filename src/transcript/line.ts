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

export function toLine(input: TranscriptLineInput): TranscriptLine {
  return { v: 1, ...input };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseRecordLine(line: string): TranscriptLine | null {
  const text = line.trim();
  if (!text) return null;
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isRecord(value)) return null;
  if (value.v !== 1) return null;
  if (typeof value.sessionId !== 'string' || typeof value.at !== 'string') return null;
  if (Number.isNaN(Date.parse(value.at))) return null;
  if (value.kind !== 'user' && value.kind !== 'assistant' && value.kind !== 'tool' && value.kind !== 'system') return null;
  if (typeof value.text !== 'string') return null;
  if (value.who !== undefined && typeof value.who !== 'string') return null;
  return value as unknown as TranscriptLine;
}

export function parseJsonl(content: string): { records: TranscriptLine[]; skipped: number } {
  let skipped = 0;
  const records: TranscriptLine[] = [];
  for (const line of content.split(/\r?\n/)) {
    const record = parseRecordLine(line);
    if (record) records.push(record);
    else if (line.trim()) skipped++;
  }
  return { records, skipped };
}
