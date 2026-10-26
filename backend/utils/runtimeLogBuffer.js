const entries = [];
const levels = ['log', 'info', 'warn', 'error'];
const originals = {};

const toSafeText = (value) => {
    let text;
    if (value instanceof Error) text = `${value.name}: ${value.message}`;
    else if (typeof value === 'string') text = value;
    else {
        try { text = JSON.stringify(value); }
        catch { text = String(value); }
    }
    return String(text || '').replace(/(password|token|secret|authorization)\s*[:=]\s*[^,\s]+/gi, '$1=[REDACTED]').slice(0, 900);
};

levels.forEach((level) => {
    originals[level] = console[level].bind(console);
    console[level] = (...args) => {
        try {
            entries.push({
                id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                timestamp: new Date().toISOString(),
                level: level === 'log' ? 'info' : level,
                message: args.map(toSafeText).join(' ').slice(0, 1400)
            });
            if (entries.length > 300) entries.splice(0, entries.length - 300);
        } catch {}
        originals[level](...args);
    };
});

exports.getRuntimeLogs = (limit = 100) => entries.slice(-Math.max(1, Math.min(Number(limit) || 100, 300))).reverse();
