/**
 * dsh wiring for obsidian-push: renders archived transcript sidecars into the
 * user's Obsidian vault, and `/archive` walks the whole chain (归档检查 → 推送 →
 * 检索面) with one line per step. Reads the transcript JSONL contract (same
 * schema and default dataDir as dsh-plugin-transcript); never writes sidecars.
 */
import type { Context } from '@deepseek-ai/cordis';
import Schema from '@deepseek-ai/schemastery';
export declare const name = "obsidian-push";
export declare const inject: string[];
export interface Config {
    enabled: boolean;
    /** Obsidian vault root; required */
    vaultDir: string;
    subfolder: string;
    tags: string[];
    dataDir?: string;
}
export declare const Config: Schema<Schemastery.ObjectS<{
    enabled: Schema<boolean, boolean>;
    vaultDir: Schema<string, string>;
    subfolder: Schema<string, string>;
    tags: Schema<string[], string[]>;
    dataDir: Schema<string, string>;
}>, Schemastery.ObjectT<{
    enabled: Schema<boolean, boolean>;
    vaultDir: Schema<string, string>;
    subfolder: Schema<string, string>;
    tags: Schema<string[], string[]>;
    dataDir: Schema<string, string>;
}>>;
export declare function expandHome(dir: string): string;
export interface PushResult {
    written: number;
    skipped: number;
    details: string[];
    targets: number;
}
export declare function apply(ctx: Context, config: Config): void;
//# sourceMappingURL=plugin.d.ts.map