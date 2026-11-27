// Omnicord release notes, newest first. Shown in Settings → Changelog and as a "What's new" popup after updates.
export interface ChangelogEntry { v: number; date: string; title: string; items: string[]; }

export const CHANGELOG: ChangelogEntry[] = [
    {
        v: 37, date: "2026-11-27", title: "Highlights + gradients",
        items: [
            "New: Message Highlights: tint + colored left bar for your messages, mentions, friends, chosen people, keywords",
            "New: gradient chat background (2 or 3 colors, ↓ → ↘, 6 presets), alone or over your picture",
        ],
    },
    {
        v: 36, date: "2026-11-27", title: "Edit fix + more customisation",
        items: [
            "Fix: editing a message twice put \"✏️ old text\" in the box and sent a message only you could see",
            "New: Ω button look: edge tab / circle / square, your own symbol, colors, border, 6 color presets",
            "New: Custom Theme day / night schedule (saved themes or presets, your own times)",
            "New: Show Me Your Name: 12h / 24h clock and date format",
        ],
    },
    {
        v: 35, date: "2026-11-23", title: "Cleaner What's new",
        items: [
            "Change: What's new is now a Discord-style bottom sheet (dark, rounded, Discord font)",
            "Change: colored New / Fix / Change tags",
            "Change: Changelog page uses the same cards",
        ],
    },
    {
        v: 34, date: "2026-11-23", title: "Ω toggles",
        items: [
            "New: Ω menu switches for Silent Typing, Fake Deafen, No Reply Mention, Hide Blocked, Anonymise File Names, Clear URLs, Ghost Ping and Keyword alerts",
            "Change: they turn the whole plugin on/off, no need to enable it in Settings first",
            "Change: Fake Deafen is active while the plugin is on",
        ],
    },
    {
        v: 33, date: "2026-11-23", title: "Changelog",
        items: [
            "New: Changelog page in Settings → Omnicord",
            "New: \"What's new\" popup after an update",
        ],
    },
    {
        v: 32, date: "2026-11-23", title: "More Equicord ports",
        items: [
            "New: Fake Deafen (look muted/deafened, still hear) + Ω toggle",
            "New: Ghost Ping Detector",
            "New: Relationship Notifier (unfriended, request cancelled, removed from server)",
            "New: Keyword Notify",
            "New: Message Tags (/tag, /tag-save, /tag-list, /tag-delete)",
            "New: Hide Blocked Messages",
        ],
    },
    {
        v: 31, date: "2026-11-23", title: "Equicord ports",
        items: [
            "New: Silent Typing + Ω toggle",
            "New: No Reply Mention",
            "New: Clear URLs (strips tracking from links you send)",
            "New: Anonymise File Names",
            "New: Copy Raw (long-press → Copy raw text)",
            "New: Show Me Your Name (+ seconds / full date on times)",
        ],
    },
    {
        v: 30, date: "2026-11-23", title: "Fake Nitro fix",
        items: [
            "Fix: \"[object Object]\" when sending stickers",
            "Change: lone sticker/emoji sent as bare link, only the picture shows",
        ],
    },
    {
        v: 29, date: "2026-11-20", title: "Parallax + Custom RPC",
        items: [
            "New: touch parallax on background picture, smoothness setting",
            "New: Custom RPC (Playing/Listening/Watching/Competing/Streaming, pictures, buttons, timer) + Ω toggle",
        ],
    },
    {
        v: 28, date: "2026-11-20", title: "Fake Nitro",
        items: [
            "New: Fake Nitro: any emoji/sticker, unusable ones sent as media links",
            "Settings: emoji size, hide link text · Ω toggle",
        ],
    },
    {
        v: 27, date: "2026-11-20", title: "Signing",
        items: ["Manager: backs up the Discord signing key outside the app, reinstalls keep it"],
    },
    {
        v: 26, date: "2026-11-19", title: "Background controls",
        items: ["New: background zoom, move left/right/up/down, fit (Fill / Whole / Stretch), reset"],
    },
    {
        v: 25, date: "2026-11-19", title: "Theme + font fixes",
        items: [
            "Fix: screens drawn before the theme (DM list) now repaint",
            "New: Reload Discord button in Custom Theme",
            "Fix: fonts now swap through Android's own font loading (re-patch needed)",
        ],
    },
    {
        v: 24, date: "2026-11-19", title: "Custom Theme rebuilt",
        items: [
            "New: live preview card + live apply",
            "New: color picker (120-color grid, lighter/darker, hue, hex)",
            "New: colors for links, message box, tab bar, mention highlight",
            "New: accent tint + background brightness",
            "New: 20 presets, theme from accent (dark/light), random",
            "New: recolor any single Discord color (search)",
            "New: saved themes, import/export (Omnicord, Kettu, Bunny, Vendetta JSON)",
            "New: 21 one-tap fonts",
        ],
    },
    {
        v: 23, date: "2026-11-17", title: "Translator fixes",
        items: [
            "Fix: translating received messages",
            "Fix: Show original",
            "Fix: stickers / pending messages skipped",
            "New: fallback translation server",
        ],
    },
    {
        v: 22, date: "2026-11-17", title: "App icon",
        items: ["Manager: your picture as the Omnicord app icon"],
    },
];

export const latestVersion = CHANGELOG[0].v;

// "What's new" popup state (rendered by the Ω overlay, styled like Discord instead of a stock Android dialog).
let pending: ChangelogEntry[] | null = null;
const listeners = new Set<() => void>();
export const getWhatsNew = () => pending;
export const subscribeWhatsNew = (l: () => void) => (listeners.add(l), () => void listeners.delete(l));
export const showWhatsNew = (e: ChangelogEntry[] | null) => { pending = e?.length ? e : null; listeners.forEach(l => l()); };
