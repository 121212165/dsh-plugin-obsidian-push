/**
 * dsh wiring for obsidian-push: renders archived transcript sidecars into the
 * user's Obsidian vault, and `/archive` walks the whole chain (归档检查 → 推送 →
 * 检索面) with one line per step. Reads the transcript JSONL contract (same
 * schema and default dataDir as dsh-plugin-transcript); never writes sidecars.
 */
import type { Context } from '@deepseek-ai/cordis';
import Schema from '@deepseek-ai/schemastery';
import type {} from '@deepseek-ai/dsh-commands';
import { mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

import { parseJsonl, type TranscriptLine } from './transcript/line.ts';
import { planNote, decide, type PushRecordLike } from './push.ts';
import { archiveVerdict, checkArchive, renderSteps, sessionMatches, shortId, type ArchiveCheck, type StepOutcome } from './archive.ts';
import { parseVaultRegistry, pickVault } from './vault.ts';

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

export interface PushResult {
  written: number;
  skipped: number;
  details: string[];
  targets: number;
}

/** The push half, shared by /obsidian-push and /archive. */
function pushSessions(groups: Map<string, TranscriptLine[]>, argument: string, options: { vaultDir: string; subfolder: string; tags: string[] }): PushResult {
  const targets = [...groups.keys()].filter((id) => sessionMatches(id, argument));
  if (!targets.length) return { written: 0, skipped: 0, details: [], targets: 0 };
  const targetDir = join(options.vaultDir, options.subfolder);
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
  return { written, skipped, details, targets: targets.length };
}

/** Markdown files transcript has flushed, as a set of filenames. */
function flushedMarkdown(dataDir: string): Set<string> {
  const dir = join(dataDir, 'markdown');
  if (!existsSync(dir)) return new Set();
  try {
    return new Set(readdirSync(dir).filter((file) => file.endsWith('.md')));
  } catch {
    return new Set();
  }
}

export function apply(ctx: Context, config: Config): void {
  const log = ctx.logger('obsidian-push');
  if (!config.enabled) return void log.info('disabled by config');

  // zero-config: discover the vault from Obsidian's own registry when unset
  let vaultDir = config.vaultDir ? expandHome(config.vaultDir) : '';
  if (!vaultDir) {
    try {
      const appData = process.env.APPDATA ?? join(homedir(), 'AppData', 'Roaming');
      const registry = join(appData, 'obsidian', 'obsidian.json');
      const discovered = pickVault(parseVaultRegistry(readFileSync(registry, 'utf8')));
      if (discovered) {
        vaultDir = discovered;
        log.info(`vaultDir auto-discovered: ${discovered}`);
      }
    } catch (error) {
      log.warn(`vault auto-discovery failed: ${String(error)}`);
    }
  }
  if (!vaultDir) return void log.info('vaultDir not configured and no Obsidian vault found — set obsidian-push.vaultDir');

  const dataDir = config.dataDir ? expandHome(config.dataDir) : join(homedir(), '.dsh', 'transcripts');
  const options = { vaultDir, subfolder: config.subfolder, tags: config.tags };

  ctx.commands.register({
    name: 'obsidian-push',
    description: '把归档会话转录推送为 Obsidian 笔记：/obsidian-push [sessionId|短id|all]（缺省 all）；整条链一步走完用 /archive',
    input: { hint: '[sessionId|短id|all]' },
    handler: ({ rawInput }) => {
      const records = readAllLines(dataDir);
      if (!records.length) return { kind: 'error', text: `还没有归档转录（${dataDir}）。` };
      const groups = groupBySession(records);
      const argument = String(rawInput ?? '').trim() || 'all';
      const result = pushSessions(groups, argument, options);
      if (!result.targets) return { kind: 'error', text: `没有匹配 ${argument} 的会话（现有 ${groups.size} 个，短 id 也可以）。` };
      return {
        kind: 'success',
        text: `推送完成：${result.written} 写入 / ${result.skipped} 跳过（内容未变）。\n${result.details.slice(0, 10).join('\n')}`,
      };
    },
  });

  ctx.commands.register({
    name: 'archive',
    description: '归档链三步一次走完：① 检查 transcript 有没有会话没落 markdown ② 推送到 Obsidian ③ 报告可检索面（transcript-search）',
    input: { hint: '[sessionId|短id|all]' },
    handler: ({ rawInput }) => {
      const records = readAllLines(dataDir);
      if (!records.length) {
        return {
          kind: 'error',
          text: renderSteps('/archive', [
            { title: '归档检查', mark: 'bad', detail: `转录目录空或不存在（${dataDir}）`, next: '先装 dsh-plugin-transcript，让会话结束时落 transcript-YYYY-MM.jsonl' },
          ]),
        };
      }
      const groups = groupBySession(records);
      const counts = new Map<string, number>();
      for (const [sessionId, lines] of groups) counts.set(sessionId, lines.length);
      const check: ArchiveCheck = checkArchive(counts, flushedMarkdown(dataDir));

      const steps: StepOutcome[] = [
        check.missing.length
          ? {
              title: 'transcript 归档检查',
              mark: 'warn',
              detail: `${check.sessions} 个会话 / ${check.lines} 行里，${check.missing.length}${check.truncated ? '+' : ''} 个没有 markdown（崩溃或未 dispose）`,
              next: `在 dsh 里对这些会话跑 /transcript-export；短 id：${check.missing.map((sessionId) => shortId(sessionId)).join(' ')}`,
            }
          : { title: 'transcript 归档检查', mark: 'ok', detail: `${check.sessions} 个会话 / ${check.lines} 行，markdown 全部齐` },
      ];

      const argument = String(rawInput ?? '').trim() || 'all';
      const pushed = pushSessions(groups, argument, options);
      steps.push(
        pushed.targets === 0
          ? { title: 'Obsidian 推送', mark: 'bad', detail: `没有匹配「${argument}」的会话`, next: '/archive all 推全部，或 /archive <短 id>' }
          : pushed.written === 0
            ? { title: 'Obsidian 推送', mark: 'ok', detail: `${pushed.targets} 个目标全部命中已有笔记，${pushed.skipped} 篇内容未变跳过`, next: `笔记在库里的 ${options.subfolder}/ 下` }
            : {
                title: 'Obsidian 推送',
                mark: 'ok',
                detail: `写入 ${pushed.written} 篇 · 跳过 ${pushed.skipped} 篇（内容未变）`,
                next: pushed.details.slice(0, 3).join(' | '),
              },
      );

      steps.push({
        title: '检索面（transcript-search）',
        mark: 'ok',
        detail: `${check.lines} 行可检索。它每次查询都从 transcript-YYYY-MM.jsonl 重建索引，磁盘上没有索引文件可"刷新"，所以也不存在陈旧索引`,
        next: '随时 /find <关键词>（注意它的短 id 取 8 位，本插件的 markdown 文件名取 12 位）',
      });

      return { kind: 'success', text: `${renderSteps('/archive', steps)}\n\n判定：${archiveVerdict(check, pushed.written, pushed.skipped)}` };
    },
  });

  log.info(`mounted · vault=${vaultDir}/${config.subfolder}`);
}
