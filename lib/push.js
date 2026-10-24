import { createHash } from 'node:crypto';
export function frontmatter(options, sessionId, firstAt, lastAt, entries) {
    const lines = ['---', `title: "${(options.title ?? `Session ${sessionId.slice(0, 8)}`).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`, `date: ${firstAt.slice(0, 10)}`, `session: ${sessionId}`, `entries: ${entries}`, `first: ${firstAt}`, `last: ${lastAt}`, 'tags:'];
    for (const tag of options.tags)
        lines.push(`  - ${tag}`);
    lines.push('---');
    return lines.join('\n');
}
/** Sortable, collision-free: day + short session id. The harness prefixes
 * every id with 'session-' — strip it and keep 12 chars of the uuid part,
 * matching html-report (8 chars of uuid collided same-day). */
export function shortSessionId(sessionId) {
    return sessionId.replace(/^session-/, '').slice(0, 12);
}
export function noteFilename(sessionId, firstAt) {
    return `${firstAt.slice(0, 10)}-${shortSessionId(sessionId)}.md`;
}
export function planNote(records, options) {
    if (!records.length)
        return null;
    const sorted = [...records].sort((a, b) => (a.at < b.at ? -1 : 1));
    const sessionId = sorted[0].sessionId;
    const firstAt = sorted[0].at;
    const lastAt = sorted[sorted.length - 1].at;
    const body = sorted
        .map((record) => {
        if (record.kind === 'user')
            return `## 👤 用户\n\n${record.text}`;
        if (record.kind === 'assistant')
            return `## 🤖 助手${record.who ? ` · ${record.who}` : ''}\n\n${record.text}`;
        if (record.kind === 'tool')
            return `- 🔧 \`${record.who ?? 'tool'}\`${record.text ? ` — ${record.text.slice(0, 200).replace(/\n/g, ' ')}` : ''}`;
        return `> ℹ️ ${record.text}`;
    })
        .join('\n\n');
    const content = `${frontmatter(options, sessionId, firstAt, lastAt, sorted.length)}\n\n${body}\n`;
    return {
        path: joinVault(options.vaultDir, options.subfolder, noteFilename(sessionId, firstAt)),
        content,
        hash: createHash('sha256').update(content).digest('hex').slice(0, 16),
        sessionId,
        day: firstAt.slice(0, 10),
    };
}
function joinVault(vaultDir, subfolder, filename) {
    return [vaultDir.replace(/[\\/]+$/, ''), subfolder.replace(/^[\\/]+|[\\/]+$/g, ''), filename].filter(Boolean).join('/');
}
export function decide(existingContent, planned) {
    if (existingContent === null)
        return { action: 'write', reason: 'new' };
    if (createHash('sha256').update(existingContent).digest('hex').slice(0, 16) === planned.hash) {
        return { action: 'skip', reason: 'identical' };
    }
    return { action: 'write', reason: 'updated' };
}
/** Single-file push decision (used by /obsidian-push-file): the file goes in
 * verbatim — no frontmatter, no hash rewriting — so the idempotence check is a
 * plain content comparison. */
export function decideFile(existingContent, content) {
    if (existingContent !== null && existingContent === content)
        return { action: 'skip', reason: '内容未变' };
    return { action: 'write', reason: existingContent === null ? '新建' : '内容有变化，覆盖' };
}
//# sourceMappingURL=push.js.map