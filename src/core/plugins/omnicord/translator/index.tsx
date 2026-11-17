import { Txt } from "@core/ui/components/SafeUI";
import { hideSheet, makeRow, patchMessageSheet } from "../shared/actionSheet";
import { nameOf, onJsx, seenNames } from "../shared/jsx";
import { addQuickActions, openQuickMenu } from "../shared/quick";
import { icon, Input, Scroll, Section, Switch } from "../shared/ui";
import { before, findByProps, findByStoreName, FluxDispatcher, instead, logger, omniPlugin, React, ReactNative as RN, registerCommand, showToast, useProxy } from "../vd";
import { translateSafe } from "./api";

const defaults = {
    target: "en",      // language you read
    outTarget: "en",   // language you send in
    immersive: true,   // keep original + translation
    autoOut: false,    // translate your outgoing messages
    chatButton: true,  // 🌐 button in the chat bar
};
type S = typeof defaults;

const originals = new Map<string, { channel_id: string; content: string; }>();
let patches: (() => void)[] = [];

const MessageStore = () => findByStoreName("MessageStore");
const ChannelStore = () => findByStoreName("ChannelStore");

// Full message in the update: a partial one (no author / stickers / embeds) is treated by Discord as an
// embed-only update on received messages, so the text didn't change or couldn't be restored.
function setContent(msg: { id: string; channel_id: string; }, content: string) {
    const rec = MessageStore().getMessage(msg.channel_id, msg.id);
    const base = rec ? (rec.toJS?.() ?? { ...rec }) : { id: msg.id, channel_id: msg.channel_id };
    FluxDispatcher.dispatch({
        type: "MESSAGE_UPDATE",
        message: { ...base, guild_id: ChannelStore().getChannel(msg.channel_id)?.guild_id, content },
        log_edit: false,
        otherPluginBypass: true,
        __eqm_internal: true,
    } as any);
}

// Only real, already-sent text messages (skips stickers-only, pending sends, failed sends, system rows).
const translatable = (m: any) => typeof m?.content === "string" && m.content.trim()
    && !m.content.includes("\n-# 🌐 ") && m.state !== "SENDING" && m.state !== "SEND_FAILED"
    && m.author?.id !== "1" && !m.__eqm_deleted;

const LANGS: [string, string][] = [
    ["en", "English"], ["fr", "Français"], ["es", "Español"], ["de", "Deutsch"], ["it", "Italiano"], ["pt", "Português"],
    ["nl", "Nederlands"], ["pl", "Polski"], ["ru", "Русский"], ["uk", "Українська"], ["tr", "Türkçe"], ["ar", "العربية"],
    ["hi", "हिन्दी"], ["ja", "日本語"], ["ko", "한국어"], ["zh-CN", "中文"], ["vi", "Tiếng Việt"], ["id", "Indonesia"],
];
const langName = (c: string) => LANGS.find(([k]) => k === c)?.[1] ?? c;

async function translateOne(msg: any, s: S) {
    if (!translatable(msg)) return false;
    const { src, text } = await translateSafe(msg.content, s.target);
    if (!text || src === s.target || text.trim() === msg.content.trim()) return false;
    originals.set(msg.id, { channel_id: msg.channel_id, content: msg.content });
    const tag = `-# 🌐 ${src} → ${s.target}`;
    setContent(msg, s.immersive ? `${msg.content}\n${text}\n${tag}` : `${text}\n${tag}`);
    return true;
}

const currentChannel = () => findByStoreName("SelectedChannelStore")?.getChannelId?.();

function recentMessages(channelId: string, n: number): any[] {
    const m = MessageStore().getMessages(channelId);
    const arr: any[] = m?.toArray?.() ?? m?._array ?? [];
    return arr.slice(-n);
}

async function translateChat(s: S) {
    const cid = currentChannel();
    if (!cid) return showToast("Open a chat first");
    const msgs = recentMessages(cid, 30).filter(m => translatable(m) && !originals.has(m.id));
    if (!msgs.length) return showToast("Nothing to translate");
    showToast(`Translating ${msgs.length} messages…`);
    let done = 0;
    for (const m of msgs) {
        try { if (await translateOne(m, s)) done++; } catch (e) { logger.error(e); }
    }
    showToast(done ? `Translated ${done} messages` : `Already in ${langName(s.target)}`, icon("check"));
}

function restoreChat(all = false) {
    const cid = currentChannel();
    let n = 0;
    for (const [id, o] of originals) {
        if (!all && o.channel_id !== cid) continue;
        setContent({ id, channel_id: o.channel_id }, o.content);
        originals.delete(id); n++;
    }
    showToast(n ? `Restored ${n} messages` : "Nothing to restore");
}

const TR_IDS = ["tr-chat", "tr-restore", "tr-auto", "tr-lang", "tr-out"];

function ChatTranslateButton({ s }: { s: S; }) {
    useProxy(s);
    const src = icon("LanguageIcon") ?? icon("ic_locale_24px");
    const tint = s.autoOut ? "#7c5cff" : "#b5bac1";
    return (
        <RN.Pressable
            hitSlop={6}
            onPress={() => openQuickMenu(TR_IDS, "Translate")}
            onLongPress={() => { s.autoOut = !s.autoOut; showToast(`Auto-translate sending: ${s.autoOut ? "ON → " + langName(s.outTarget) : "OFF"}`); }}
            style={{ width: 36, height: 36, alignItems: "center", justifyContent: "center", marginHorizontal: 2 }}>
            {src ? <RN.Image source={src} style={{ width: 24, height: 24, tintColor: tint }} />
                : <Txt style={{ fontSize: 20, color: tint }}>🌐</Txt>}
        </RN.Pressable>
    );
}

export default omniPlugin<S>({
    id: "translator",
    name: "Translator",
    description: "Translate messages (long-press), /translate, optional auto-translate of what you send",
    defaults,
    start(s) {
        const MessageActions = findByProps("sendMessage", "receiveMessage");
        const BotMessage = findByProps("sendBotMessage");

        const toggle = async (message: any) => {
            hideSheet();
            const msg = MessageStore().getMessage(message.channel_id, message.id) ?? message;
            const orig = originals.get(message.id);
            if (orig) { setContent({ id: message.id, channel_id: orig.channel_id }, orig.content); originals.delete(message.id); return; }
            try {
                if (!await translateOne(msg, s)) showToast(translatable(msg) ? `Already in ${langName(s.target)}` : "Nothing to translate");
            } catch (e) {
                logger.error(e);
                showToast("Translation failed", icon("Small"));
            }
        };

        patches.push(before("dispatch", FluxDispatcher, ([ev]: any[]) => {
            if (ev?.type === "MESSAGE_UPDATE" && !ev.__eqm_internal && ev.log_edit !== false
                && typeof ev.message?.content === "string" && originals.has(ev.message.id)) originals.delete(ev.message.id);
        }));

        patches.push(addQuickActions(
            { id: "tr-chat", order: 20, icon: ["LanguageIcon", "GlobeEarthIcon", "ic_locale_24px"], label: "Translate this chat", sub: () => `Last 30 messages → ${langName(s.target)}`, run: () => translateChat(s) },
            { id: "tr-restore", order: 21, icon: ["ArrowAngleLeftUpIcon", "ArrowsLeftRightIcon", "ic_reply_24px", "ic_undo_24px"], label: "Show originals", sub: "Undo translations in this chat", run: () => restoreChat() },
            {
                id: "tr-auto", order: 22, keepOpen: true, icon: ["PencilIcon", "ic_edit_24px"], toggled: () => s.autoOut,
                label: "Auto-translate what I send",
                sub: () => `Sends in ${langName(s.outTarget)}`,
                run: () => { s.autoOut = !s.autoOut; },
            },
            {
                id: "tr-lang", order: 23, icon: ["EyeIcon", "ic_eye"], label: "Read in", sub: () => langName(s.target),
                choices: () => LANGS.map(([k, n]) => ({ label: n, selected: s.target === k, run: () => { s.target = k; } })),
            },
            {
                id: "tr-out", order: 24, icon: ["SendMessageIcon", "ic_send"], label: "Send in", sub: () => langName(s.outTarget),
                choices: () => LANGS.map(([k, n]) => ({ label: n, selected: s.outTarget === k, run: () => { s.outTarget = k; } })),
            },
        ));

        // 🌐 next to the gift button in the chat bar (matched by name so it survives Discord updates).
        patches.push(onJsx(/Gift/, (C, _props, ret) => {
            const n = nameOf(C) ?? "";
            if (!s.chatButton || !/ChatInput|Button/i.test(n) || /Icon$|Modal|Sheet|Badge|Premium|Nitro|Upsell/i.test(n)) return;
            return <React.Fragment key={ret?.key ?? "omni-gift"}><ChatTranslateButton key="omni-tr" s={s} />{ret}</React.Fragment>;
        }));

        patches.push(patchMessageSheet(message => {
            if (!message.content) return;
            const done = originals.has(message.id);
            return [makeRow(done ? "Show original" : "Translate", icon(done ? "ic_highlight" : "LanguageIcon") ?? icon("ic_locale_24px"), () => toggle(message), "omni-translate")];
        }));

        patches.push(instead("sendMessage", MessageActions, (args: any[], orig: any) => {
            const msg = args[1];
            const extra = args[3] ?? {};
            if (!s.autoOut || !msg?.content?.trim() || extra.stickerIds?.length || msg.sticker_ids?.length || extra.poll) return orig(...args);
            return translateSafe(msg.content, s.outTarget)
                .then(r => { if (r.text) msg.content = r.text; }, e => logger.error(e))
                .then(() => orig(...args), () => orig(...args));
        }));

        patches.push(registerCommand({
            name: "translate",
            displayName: "translate",
            description: "Translate text",
            displayDescription: "Translate text",
            options: [
                { name: "text", displayName: "text", description: "Text to translate", displayDescription: "Text to translate", type: 3, required: true },
                { name: "to", displayName: "to", description: "Target language code (e.g. fr, de, ja)", displayDescription: "Target language code (e.g. fr, de, ja)", type: 3, required: false },
                { name: "send", displayName: "send", description: "Send it to the channel (default: only you see it)", displayDescription: "Send it to the channel (default: only you see it)", type: 5, required: false },
            ],
            applicationId: "-1",
            inputType: 1,
            type: 1,
            async execute(args: any[], ctx: any) {
                const get = (n: string) => args.find(a => a.name === n)?.value;
                const to = get("to") || s.outTarget;
                try {
                    const r = await translateSafe(get("text"), to);
                    if (get("send")) return { content: r.text };
                    BotMessage.sendBotMessage(ctx.channel.id, `${r.text}\n-# 🌐 ${r.src} → ${to}`);
                } catch (e) {
                    BotMessage.sendBotMessage(ctx.channel.id, `Translation failed: ${e}`);
                }
            },
        } as any));
    },
    stop() {
        patches.splice(0).forEach(p => p());
        for (const [id, o] of originals) setContent({ id, channel_id: o.channel_id }, o.content);
        originals.clear();
    },
    Settings({ storage }) {
        useProxy(storage);
        return (
            <Scroll>
                <Section title="Reading">
                    <Input store={storage} k="target" title="Translate messages to (language code, e.g. en, fr)" placeholder="en" />
                    <Switch store={storage} k="immersive" label="Keep original text" sub="Show original above the translation" />
                </Section>
                <Section title="Buttons">
                    <Switch store={storage} k="chatButton" label="🌐 button in the chat bar" sub="Tap: translate menu · Long-press: auto-translate on/off" />
                </Section>
                <Section title="Sending">
                    <Switch store={storage} k="autoOut" label="Auto-translate what I send" sub="Every message you send gets translated first" />
                    <Input store={storage} k="outTarget" title="Send messages in (language code)" placeholder="en" />
                </Section>
                <Section title="Debug (screenshot this if the 🌐 button is missing)">
                    <Txt selectable style={{ color: "#949ba4", fontSize: 11, padding: 12 }}>{seenNames().join(", ") || "Open a chat first, then come back."}</Txt>
                </Section>
            </Scroll>
        );
    },
});
