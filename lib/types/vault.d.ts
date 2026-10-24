/** Zero-config vault discovery: read Obsidian's own registry
 * (%APPDATA%/obsidian/obsidian.json) and pick the vault the user actually
 * uses — the one currently open, else the most recently opened. Plugins must
 * work when enabled, not demand a hand-typed absolute path.
 * @module vault */
export interface VaultCandidate {
    path: string;
    open?: boolean;
    ts?: number | undefined;
}
/** Pick the best vault from a parsed obsidian.json: open first, then newest. */
export declare function pickVault(candidates: VaultCandidate[]): string | null;
/** Parse the raw obsidian.json content; tolerant of garbage. */
export declare function parseVaultRegistry(content: string): VaultCandidate[];
/** Every known obsidian.json location across platforms, in try order:
 * Windows (APPDATA), macOS (Library/Application Support), Linux (~/.config). */
export declare function registryPaths(env?: {
    APPDATA?: string;
    HOME?: string;
}): string[];
//# sourceMappingURL=vault.d.ts.map