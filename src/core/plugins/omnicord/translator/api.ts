// Google Translate (gtx endpoint, same one Vencord/Equicord Translate uses).
async function gtx(text: string, target: string, source: string) {
    const url = "https://translate.googleapis.com/translate_a/single?" + new URLSearchParams({
        client: "gtx", sl: source, tl: target, dt: "t", dj: "1", source: "input", q: text,
    });
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!res.ok) throw new Error(`Translate HTTP ${res.status}`);
    const data = await res.json();
    return {
        src: (data.src ?? source) as string,
        text: (data.sentences ?? []).map((s: any) => s.trans ?? "").join(""),
    };
}

// Fallback endpoint (POST, no URL length limit) used when gtx fails or rate-limits.
async function dict(text: string, target: string, source: string) {
    const res = await fetch(`https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=${source}&tl=${encodeURIComponent(target)}`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "q=" + encodeURIComponent(text),
    });
    if (!res.ok) throw new Error(`Translate HTTP ${res.status}`);
    const d = await res.json();
    const first = Array.isArray(d) ? d[0] : d?.sentences;
    if (Array.isArray(first)) return { text: String(first[0] ?? ""), src: String(first[1] ?? source) };
    if (typeof first === "string") return { text: first, src: source };
    throw new Error("Translate: bad response");
}

export async function translate(text: string, target: string, source = "auto") {
    try {
        if (text.length < 1800) return await gtx(text, target, source);
    } catch { /* fall through */ }
    try { return await dict(text, target, source); } catch (e) {
        await new Promise(r => setTimeout(r, 700));
        return gtx(text.slice(0, 1800), target, source).catch(() => { throw e; });
    }
}

// Keep mentions, channels, custom emojis, links and code untouched.
const PROTECT = /<a?:\w+:\d+>|<@[!&]?\d+>|<#\d+>|<\/[\w -]+:\d+>|https?:\/\/\S+|```[\s\S]*?```|`[^`]*`/g;

export async function translateSafe(text: string, target: string) {
    const kept: string[] = [];
    const masked = text.replace(PROTECT, m => (kept.push(m), ` [[${kept.length - 1}]] `));
    const r = await translate(masked, target);
    r.text = r.text.replace(/\[\[\s*(\d+)\s*\]\]/g, (_: string, i: string) => kept[+i] ?? "").replace(/ {2,}/g, " ").trim();
    return r;
}
