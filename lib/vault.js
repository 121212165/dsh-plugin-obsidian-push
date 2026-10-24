import { join } from 'node:path';
/** Pick the best vault from a parsed obsidian.json: open first, then newest. */
export function pickVault(candidates) {
    const usable = candidates.filter((candidate) => typeof candidate.path === 'string' && candidate.path.trim() !== '');
    if (!usable.length)
        return null;
    const open = usable.find((candidate) => candidate.open === true);
    if (open)
        return open.path;
    const newest = [...usable].sort((a, b) => (b.ts ?? 0) - (a.ts ?? 0));
    return newest[0].path;
}
/** Parse the raw obsidian.json content; tolerant of garbage. */
export function parseVaultRegistry(content) {
    try {
        const parsed = JSON.parse(content);
        if (typeof parsed !== 'object' || parsed === null)
            return [];
        const vaults = parsed.vaults;
        if (typeof vaults !== 'object' || vaults === null)
            return [];
        return Object.values(vaults)
            .filter((v) => typeof v === 'object' && v !== null)
            .map((v) => ({ path: typeof v.path === 'string' ? v.path : '', open: v.open === true, ts: typeof v.ts === 'number' ? v.ts : undefined }));
    }
    catch {
        return [];
    }
}
/** Every known obsidian.json location across platforms, in try order:
 * Windows (APPDATA), macOS (Library/Application Support), Linux (~/.config). */
export function registryPaths(env = process.env) {
    const home = env.HOME ?? '';
    const paths = [];
    if (env.APPDATA)
        paths.push(join(env.APPDATA, 'obsidian', 'obsidian.json'));
    if (home) {
        paths.push(join(home, 'Library', 'Application Support', 'obsidian', 'obsidian.json'));
        paths.push(join(home, '.config', 'obsidian', 'obsidian.json'));
        if (!env.APPDATA)
            paths.push(join(home, 'AppData', 'Roaming', 'obsidian', 'obsidian.json'));
    }
    return paths;
}
//# sourceMappingURL=vault.js.map