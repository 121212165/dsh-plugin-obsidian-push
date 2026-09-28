/**
 * dsh wiring for obsidian-push: renders archived transcript sidecars into the
 * user's Obsidian vault. Reads the transcript JSONL contract (same schema and
 * default dataDir as dsh-plugin-transcript); never writes into the sidecars.
 */
import type { Context } from '@deepseek-ai/cordis';
import Schema from '@deepseek-ai/schemastery';
import type {} from '@deepseek-ai/dsh-commands';
import { mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

import { parseJsonl, type TranscriptLine } from './transcript/line.ts';
import { planNote, decide, type PushRecordLike } from './push.ts';

export const name = 'obsidian-push';
export const inject = ['commands'];

export interface Config {
  enabled: boolean;
  /** Obsidian vault root; required */
  vaultDir: string;
  subfolder: string;
  tags: string[];
  dataDir?: string;
}

export const Config = Schema.object({
  enabled: Schema.boolean().default(true),
  vaultDir: Schema.string().required(),
  subfolder: Schema.string().default('dsh-sessions'),
  tags: Schema.array(Schema.string()).default(['dsh', 'session']),
  dataDir: Schema.string(),
});

export function expandHome(dir: string): string {
  return dir.startsWith('~') ? join(homedir(), dir.slice(1)) : dir;
}

function readAllLines(dataDir: string): TranscriptLine[] {
  const records: TranscriptLine[] = [];
  if (!existsSync(dataDir)) return records;
  for (const name of readdirSync(dataDir)) {
    if (!/^transcript-(\d{4})-(\d{2})\.jsonl$/.test(name)) continue;
    records.push(...parseJsonl(readFileSync(join(dataDir, name), 'utf8')).records);
  }
  return records;
}

function groupBySession(records: TranscriptLine[]): Map<string, TranscriptLine[]> {
  const groups = new Map<string, TranscriptLine[]>();
  for (const record of records) {
    let group = groups.get(record.sessionId);
    if (!group) groups.set(record.sessionId, (group = []));
    group.push(record);
  }
  return groups;
}

export function apply(ctx: Context, config: Config): void {
  const log = ctx.logger('obsidian-push');
  if (!config.enabled) return void log.info('disabled by config');
  if (!config.vaultDir) return void log.info('vaultDir not configured — set obsidian-push.vaultDir');

  const dataDir = config.dataDir ? expandHome(config.dataDir) : join(homedir(), '.dsh', 'transcripts');
  const vaultDir = expandHome(config.vaultDir);
  const options = { vaultDir, subfolder: config.subfolder, tags: config.tags };

  ctx.commands.register({
    name: 'obsidian-push',
    description: '把归档会话转录推送为 Obsidian 笔记：/obsidian-push [sessionId|all]（缺省 all）',
    input: { hint: '[sessionId|all]' },
    handler: ({ rawInput }) => {
      const records = readAllLines(dataDir);
      if (!records.length) return { kind: 'error', text: `还没有归档转录（${dataDir}）。` };
      const argument = String(rawInput ?? '').trim() || 'all';
      const groups = groupBySession(records);
      const targets = argument === 'all' ? [...groups.keys()] : [...groups.keys()].filter((id) => id.startsWith(argument));
      if (!targets.length) return { kind: 'error', text: `没有匹配 ${argument} 的会话。` };
      const targetDir = join(vaultDir, config.subfolder);
      mkdirSync(targetDir, { recursive: true });
      let written = 0;
      let skipped = 0;
      const details: string[] = [];
      for (const sessionId of targets) {
        const planned = planNote(groups.get(sessionId) as PushRecordLike[], options);
        if (!planned) continue;
        const file = planned.path;
        const existing = existsSync(file) ? readFileSync(file, 'utf8') : null;
        const decision = decide(existing, planned);
        if (decision.action === 'skip') {
          skipped++;
          continue;
        }
        writeFileSync(file, planned.content, 'utf8');
        written++;
        details.push(`${decision.reason}: ${file}`);
      }
      return {
        kind: 'success',
        text: `推送完成：${written} 写入 / ${skipped} 跳过（内容未变）。\n${details.slice(0, 10).join('\n')}`,
      };
    },
  });

  log.info(`mounted · vault=${vaultDir}/${config.subfolder}`);
}
