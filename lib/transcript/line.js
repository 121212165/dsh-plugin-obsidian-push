export function toLine(input) {
    return { v: 1, ...input };
}
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
export function parseRecordLine(line) {
    const text = line.trim();
    if (!text)
        return null;
    let value;
    try {
        value = JSON.parse(text);
    }
    catch {
        return null;
    }
    if (!isRecord(value))
        return null;
    if (value.v !== 1)
        return null;
    if (typeof value.sessionId !== 'string' || typeof value.at !== 'string')
        return null;
    if (Number.isNaN(Date.parse(value.at)))
        return null;
    if (value.kind !== 'user' && value.kind !== 'assistant' && value.kind !== 'tool' && value.kind !== 'system')
        return null;
    if (typeof value.text !== 'string')
        return null;
    if (value.who !== undefined && typeof value.who !== 'string')
        return null;
    return value;
}
export function parseJsonl(content) {
    let skipped = 0;
    const records = [];
    for (const line of content.split(/\r?\n/)) {
        const record = parseRecordLine(line);
        if (record)
            records.push(record);
        else if (line.trim())
            skipped++;
    }
    return { records, skipped };
}
//# sourceMappingURL=line.js.map