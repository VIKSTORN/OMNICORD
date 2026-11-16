import { hideSheet, makeRow, patchMessageSheet } from "../shared/actionSheet";
import { icon, Input, Scroll, Section, Switch } from "../shared/ui";
import { findByProps, findByStoreName, FluxDispatcher, instead, logger, omniPlugin, registerCommand, showToast, useProxy } from "../vd";
import { translateSafe } from "./api";

const defaults = {
    target: "en",      // language you read
    outTarget: "en",   // language you send in
    immersive: true,   // keep original + translation
    autoOut: false,    // translate your outgoing messages
};
type S = typeof defaults;

const originals = new Map<string, { channel_id: string; content: string; }>();
let patches: (() => void)[] = [];

const MessageStore = () => findByStoreName("MessageStore");
const ChannelStore = () => findByStoreName("ChannelStore");

function setContent(msg: { id: string; channel_id: string; }, content: string) {
    FluxDispatcher.dispatch({
        type: "MESSAGE_UPDATE",
        message: { id: msg.id, channel_id: msg.channel_id, guild_id: ChannelStore().getChannel(msg.channel_id)?.guild_id, content },
        log_edit: false,
        __eqm_internal: true,
    } as any);
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
            const orig = originals.get(msg.id);
            if (orig) { setContent(msg, orig.content); originals.delete(msg.id); return; }
            try {
                const { src, text } = await translateSafe(msg.content, s.target);
                originals.set(msg.id, { channel_id: msg.channel_id, content: msg.content });
                const tag = `-# 🌐 ${src} → ${s.target}`;
                setContent(msg, s.immersive ? `${msg.content}\n${text}\n${tag}` : `${text}\n${tag}`);
            } catch (e) {
                logger.error(e);
                showToast("Translation failed", icon("Small"));
            }
        };

        patches.push(patchMessageSheet(message => {
            if (!message.content) return;
            const done = originals.has(message.id);
            return [makeRow(done ? "Show original" : "Translate", icon(done ? "ic_highlight" : "LanguageIcon") ?? icon("ic_locale_24px"), () => toggle(message), "omni-translate")];
        }));

        patches.push(instead("sendMessage", MessageActions, (args: any[], orig: any) => {
            const msg = args[1];
            if (!s.autoOut || !msg?.content?.trim()) return orig(...args);
            return translateSafe(msg.content, s.outTarget)
                .then(r => { if (r.text) msg.content = r.text; }, e => logger.error(e))
                .then(() => orig(...args));
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
                <Section title="Sending">
                    <Switch store={storage} k="autoOut" label="Auto-translate what I send" sub="Every message you send gets translated first" />
                    <Input store={storage} k="outTarget" title="Send messages in (language code)" placeholder="en" />
                </Section>
            </Scroll>
        );
    },
});
