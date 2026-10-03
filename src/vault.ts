import { join } from 'node:path';
/** Zero-config vault discovery: read Obsidian's own registry
 * (%APPDATA%/obsidian/obsidian.json) and pick the vault the user actually
 * uses — the one currently open, else the most recently opened. Plugins must
 * work when enabled, not demand a hand-typed absolute path.
 * @module vault */

export interface VaultCandidate {
  path: string;
  open?: boolean;
  ts?: number;
}

/** Pick the best vault from a parsed obsidian.json: open first, then newest. */
export function pickVault(candidates: VaultCandidate[]): string | null {
  const usable = candidates.filter((candidate) => typeof candidate.path === 'string' && candidate.path.trim() !== '');
  if (!usable.length) return null;
  const open = usable.find((candidate) => candidate.open === true);
  if (open) return open.path;
  const newest = [...usable].sort((a, b) => (b.ts ?? 0) - (a.ts ?? 0));
  return newest[0]!.path;
}

/** Parse the raw obsidian.json content; tolerant of garbage. */
export function parseVaultRegistry(content: string): VaultCandidate[] {
  try {
    const parsed: unknown = JSON.parse(content);
    if (typeof parsed !== 'object' || parsed === null) return [];
    const vaults = (parsed as { vaults?: unknown }).vaults;
    if (typeof vaults !== 'object' || vaults === null) return [];
    return Object.values(vaults as Record<string, VaultCandidate>)
      .filter((v): v is VaultCandidate => typeof v === 'object' && v !== null)
      .map((v) => ({ path: typeof v.path === 'string' ? v.path : '', open: v.open === true, ts: typeof v.ts === 'number' ? v.ts : undefined }));
  } catch {
    return [];
  }
}

/** Every known obsidian.json location across platforms, in try order:
 * Windows (APPDATA), macOS (Library/Application Support), Linux (~/.config). */
export function registryPaths(env: { APPDATA?: string; HOME?: string } = process.env): string[] {
  const home = env.HOME ?? '';
  const paths: string[] = [];
  if (env.APPDATA) paths.push(join(env.APPDATA, 'obsidian', 'obsidian.json'));
  if (home) {
    paths.push(join(home, 'Library', 'Application Support', 'obsidian', 'obsidian.json'));
    paths.push(join(home, '.config', 'obsidian', 'obsidian.json'));
    if (!env.APPDATA) paths.push(join(home, 'AppData', 'Roaming', 'obsidian', 'obsidian.json'));
  }
  return paths;
}
