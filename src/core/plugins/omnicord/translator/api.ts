// Google Translate (gtx endpoint, same one Vencord/Equicord Translate uses).
export async function translate(text: string, target: string, source = "auto") {
    const url = "https://translate.googleapis.com/translate_a/single?" + new URLSearchParams({
        client: "gtx", sl: source, tl: target, dt: "t", dj: "1", source: "input", q: text,
    });
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Translate HTTP ${res.status}`);
    const data = await res.json();
    return {
        src: (data.src ?? source) as string,
        text: (data.sentences ?? []).map((s: any) => s.trans ?? "").join(""),
    };
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
