/**
 * Pure transcript model: tolerant text extraction from session event payloads
 * and markdown rendering. No dsh imports — the host wiring feeds it whatever
 * the events contain, so a payload shape change degrades to "less text"
 * instead of a crash.
 */

export type TranscriptKind = 'user' | 'assistant' | 'tool' | 'system';

export interface TranscriptEntry {
  kind: TranscriptKind;
  at: string; // ISO
  turn?: number;
  /** display name: model id for assistant, tool name for tool entries */
  who?: string;
  text: string;
}

interface ContentBlockLike {
  type?: string;
  text?: string;
  thinking?: string;
  reasoning?: string;
  name?: string;
}

/** dsh content blocks: {type:'text'|'thinking'|…, text?…}. Unknown blocks are
 * skipped, text blocks joined in order. */
export function textFromContent(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  const parts: string[] = [];
  for (const block of content as ContentBlockLike[]) {
    if (typeof block?.text === 'string' && block.text) parts.push(block.text);
  }
  return parts.join('\n');
}

/** Assistant stream frames. Two shapes exist in the wild (both observed in
 * dsh-token-telemetry's verified stream handling): flat chunks
 * {type:'text-delta'|'reasoning-delta',text} and grouped frames
 * {type:'text-chunks'|'reasoning-chunks',texts[],dt[]}. Unknown shapes yield
 * empty strings instead of throwing. */
export function textFromStream(stream: unknown): { body: string; reasoning: string } {
  let body = '';
  let reasoning = '';
  if (!Array.isArray(stream)) return { body, reasoning };
  for (const frame of stream as Record<string, unknown>[]) {
    if (!frame || typeof frame !== 'object') continue;
    if (frame.type === 'text-chunks' || frame.type === 'reasoning-chunks') {
      const target = frame.type === 'text-chunks' ? 'body' : 'reasoning';
      const texts = Array.isArray(frame.texts) ? (frame.texts as string[]) : [];
      const dt = Array.isArray(frame.dt) ? (frame.dt as number[]) : [];
      void dt;
      for (const text of texts) {
        if (typeof text === 'string') {
          if (target === 'body') body += text;
          else reasoning += text;
        }
      }
    } else if (frame.type === 'chunk' && frame.chunk && typeof frame.chunk === 'object') {
      const chunk = frame.chunk as { type?: string; text?: string };
      if (chunk.type === 'text-delta' && typeof chunk.text === 'string') body += chunk.text;
      else if (chunk.type === 'reasoning-delta' && typeof chunk.text === 'string') reasoning += chunk.text;
    } else {
      // flat chunk shape
      const chunk = frame as { type?: string; text?: string };
      if (chunk.type === 'text-delta' && typeof chunk.text === 'string') body += chunk.text;
      else if (chunk.type === 'reasoning-delta' && typeof chunk.text === 'string') reasoning += chunk.text;
    }
  }
  return { body, reasoning };
}

/** Assistant stream chunks ({type:'text-delta',text} | {type:'reasoning-delta',text}).
 * Reasoning goes into the transcript as a collapsible block, never mixed into body text. */
export function textFromStreamChunks(chunks: unknown): { body: string; reasoning: string } {
  let body = '';
  let reasoning = '';
  if (!Array.isArray(chunks)) return { body, reasoning };
  for (const chunk of chunks as ContentBlockLike[]) {
    if (chunk?.type === 'text-delta' && typeof chunk.text === 'string') body += chunk.text;
    else if (chunk?.type === 'reasoning-delta' && typeof chunk.text === 'string') reasoning += chunk.text;
  }
  return { body, reasoning };
}

export function renderTranscript(entries: TranscriptEntry[], meta: { sessionId: string; title?: string }): string {
  const lines: string[] = [];
  const heading = meta.title ? `# ${meta.title}` : `# Session ${meta.sessionId.slice(0, 8)}`;
  lines.push(heading, '');
  if (entries.length) lines.push(`> ${entries.length} 条记录 · 导出于渲染时刻`, '');
  for (const entry of entries) {
    if (entry.kind === 'user') {
      lines.push(`## 👤 用户`, '', entry.text, '');
    } else if (entry.kind === 'assistant') {
      lines.push(`## 🤖 助手${entry.who ? ` · ${entry.who}` : ''}`, '', entry.text, '');
    } else if (entry.kind === 'tool') {
      const preview = entry.text.length > 200 ? entry.text.slice(0, 200) + '…' : entry.text;
      lines.push(`- 🔧 \`${entry.who ?? 'tool'}\`${entry.text ? ` — ${preview.replace(/\n/g, ' ')}` : ''}`);
    } else {
      lines.push(`> ℹ️ ${entry.text}`, '');
    }
  }
  return lines.join('\n') + '\n';
}

export function countWords(text: string): { chars: number; cjk: number } {
  let cjk = 0;
  for (const char of text) {
    if (char >= '\u3000' && char <= '\u9fff') cjk++;
  }
  return { chars: text.length, cjk };
}
