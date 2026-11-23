// Fake Nitro: use any emoji / sticker you can see. The ones you can't really send go out as Discord
// media links (masked), which Discord shows as the picture, like a normal emoji or sticker.
import { addQuickActions } from "../shared/quick";
import { Input, Scroll, Section, Switch } from "../shared/ui";
import { before, findByProps, findByStoreName, instead, logger, omniPlugin, showToast, useProxy } from "../vd";

const defaults = {
    emojis: true,
    stickers: true,
    emojiSize: "48",      // px, Discord CDN sizes: 16..512
    hideLinks: true,      // [name](link) instead of the raw url
};
type S = typeof defaults;

let patches: (() => void)[] = [];
let unquick: (() => void) | undefined;

const EmojiStore = () => findByStoreName("EmojiStore");
const SelectedGuildStore = () => findByStoreName("SelectedGuildStore");
const ChannelStore = () => findByStoreName("ChannelStore");
const UserStore = () => findByStoreName("UserStore");
const StickersStore = () => findByStoreName("StickersStore");

const hasNitro = () => { const u = UserStore()?.getCurrentUser?.(); return !!u?.premiumType; };
const guildOf = (channelId?: string) => (channelId && ChannelStore()?.getChannel?.(channelId)?.guild_id) || SelectedGuildStore()?.getGuildId?.();

const link = (s: S, name: string, url: string) => s.hideLinks ? `[${name.replace(/[[\]]/g, "")}](${url})` : url;
const size = (s: S) => [16, 20, 22, 24, 28, 32, 40, 44, 48, 56, 60, 64, 80, 96, 100, 128, 160, 240, 256, 300, 320, 480, 512]
    .reduce((a, b) => Math.abs(b - +s.emojiSize) < Math.abs(a - +s.emojiSize) ? b : a, 48);

function emojiUrl(s: S, id: string, animated: boolean, name: string) {
    return `https://cdn.discordapp.com/emojis/${id}.${animated ? "gif" : "webp"}?size=${size(s)}&quality=lossless&name=${encodeURIComponent(name)}`;
}

/** Can the real account send this custom emoji here? */
function canReallyUse(emoji: { id: string; animated?: boolean; guildId?: string; guild_id?: string; }, guildId?: string) {
    if (hasNitro()) return true;
    if (emoji.animated) return false;
    const g = emoji.guildId ?? emoji.guild_id ?? EmojiStore()?.getCustomEmojiById?.(emoji.id)?.guildId;
    return !!g && g === guildId;
}

function rewriteEmojis(s: S, msg: any, channelId: string) {
    if (!s.emojis || typeof msg?.content !== "string" || !msg.content.includes("<")) return;
    const guildId = guildOf(channelId);
    const links: string[] = [];
    msg.content = msg.content.replace(/<(a?):(\w+):(\d+)>/g, (full: string, a: string, name: string, id: string) => {
        const animated = a === "a";
        if (canReallyUse({ id, animated }, guildId)) return full;
        links.push(link(s, name, emojiUrl(s, id, animated, name)));
        return " ";
    }).trim();
    if (!links.length) return;
    // A message that is only one picture link shows just the picture (Discord hides the url).
    if (!msg.content && links.length === 1) { msg.content = links[0].replace(/^\[[^\]]*\]\((.*)\)$/, "$1"); }
    else msg.content = [msg.content, ...links].filter(Boolean).join(" ");
    if (Array.isArray(msg.validNonShortcutEmojis))
        msg.validNonShortcutEmojis = msg.validNonShortcutEmojis.filter((e: any) => canReallyUse(e, guildId));
}

const STICKER_EXT: Record<number, string | undefined> = { 1: "png", 2: "png", 3: undefined, 4: "gif" };

export default omniPlugin<S>({
    id: "fake-nitro",
    name: "Fake Nitro",
    description: "Send any emoji or sticker: the ones you can't use go out as media links that show like the real thing",
    defaults,
    start(s) {
        const MessageActions = findByProps("sendMessage", "receiveMessage");

        // ---- unlock pickers (each one is optional: Discord renames these between versions) ----
        const unlock = (props: string[], value: any, when: () => boolean) => {
            const mod = findByProps(...props);
            for (const p of props) if (typeof mod?.[p] === "function")
                patches.push(instead(p, mod, (args: any[], orig: any) => when() ? value : orig(...args)));
        };
        unlock(["canUseEmojisEverywhere", "canUseAnimatedEmojis"], true, () => s.emojis);
        unlock(["canUseStickersEverywhere"], true, () => s.stickers);
        const emojiReason = findByProps("getEmojiUnavailableReason");
        if (emojiReason) patches.push(instead("getEmojiUnavailableReason", emojiReason, (args: any[], orig: any) => s.emojis ? null : orig(...args)));
        const EmojiStoreInst = EmojiStore();
        if (EmojiStoreInst?.isEmojiDisabled) patches.push(instead("isEmojiDisabled", EmojiStoreInst, (a: any[], o: any) => s.emojis ? false : o(...a)));

        const StickerUtils = findByProps("getStickerSendability", "isSendableSticker") ?? findByProps("getStickerSendability");
        let realSendability: ((...a: any[]) => any) | undefined;
        if (StickerUtils?.getStickerSendability) {
            realSendability = StickerUtils.getStickerSendability.bind(StickerUtils);
            patches.push(instead("getStickerSendability", StickerUtils, (a: any[], o: any) => s.stickers && o(...a) !== 2 ? 0 : o(...a)));
        }
        if (StickerUtils?.isSendableSticker)
            patches.push(instead("isSendableSticker", StickerUtils, (a: any[], o: any) => s.stickers ? true : o(...a)));

        // ---- emojis: rewrite on send ----
        if (MessageActions) {
            patches.push(before("sendMessage", MessageActions, (args: any[]) => {
                try { rewriteEmojis(s, args[1], args[0]); } catch (e) { logger.error("fake nitro emoji", e); }
            }));
            patches.push(before("editMessage", MessageActions, (args: any[]) => {
                try { rewriteEmojis(s, args[2], args[0]); } catch (e) { logger.error("fake nitro edit", e); }
            }));
        }

        // ---- stickers: send the ones you can't use as links ----
        const StickerSender = MessageActions?.sendStickers ? MessageActions : findByProps("sendStickers");
        if (StickerSender) patches.push(instead("sendStickers", StickerSender, (args: any[], orig: any) => {
            const [channelId, ids = []] = args;
            // 3rd arg is the typed text on some versions, an options object on others.
            const content = typeof args[2] === "string" ? args[2].trim() : "";
            if (!s.stickers || hasNitro()) return orig(...args);
            const stickers = ids.map((id: string) => StickersStore()?.getStickerById?.(id) ?? { id });
            const unusable = stickers.filter((st: any) => {
                try { return realSendability ? realSendability(st, UserStore().getCurrentUser(), ChannelStore().getChannel(channelId)) !== 0 : st.guild_id !== guildOf(channelId); } catch { return true; }
            });
            if (!unusable.length) return orig(...args);
            const links: string[] = [];
            for (const st of unusable) {
                const ext = STICKER_EXT[st.format_type ?? 1];
                if (!ext) { showToast(`"${st.name ?? "Sticker"}" is an animated Lottie sticker: can't be sent as a link`); continue; }
                // Bare url: Discord shows only the sticker picture, no link text.
                links.push(`https://media.discordapp.net/stickers/${st.id}.${ext}?size=160`);
            }
            const usable = ids.filter((id: string) => !unusable.some((u: any) => u.id === id));
            if (usable.length) orig(channelId, usable, content, ...args.slice(3));
            if (links.length) {
                return MessageActions.sendMessage(channelId, {
                    content: [usable.length ? "" : content, ...links].filter(Boolean).join(" "),
                    tts: false, invalidEmojis: [], validNonShortcutEmojis: [],
                }, undefined, {});
            }
        }));
        else logger.error("fake nitro: sendStickers not found");

        unquick = addQuickActions({
            id: "fake-nitro", order: 60, keepOpen: true,
            icon: ["NitroWheelIcon", "ic_nitro_rep", "ic_badge_premium", "EmojiIcon"],
            label: "Fake Nitro", sub: () => s.emojis || s.stickers ? "Emojis & stickers as links" : "Off",
            toggled: () => s.emojis || s.stickers,
            run: () => { const on = !(s.emojis || s.stickers); s.emojis = on; s.stickers = on; },
        });
    },
    stop() {
        unquick?.();
        patches.splice(0).forEach(p => p());
    },
    Settings({ storage }) {
        useProxy(storage);
        return (
            <Scroll>
                <Section title="Send">
                    <Switch store={storage} k="emojis" label="Any emoji" sub="Other servers' and animated emojis go out as links" />
                    <Switch store={storage} k="stickers" label="Any sticker" sub="Other servers' stickers go out as links (not Lottie ones)" />
                    <Switch store={storage} k="hideLinks" label="Hide link text" sub="Only the picture shows, not the long URL" />
                </Section>
                <Section title="Emoji size">
                    <Input store={storage} k="emojiSize" title="Pixels (48 = normal, 128 = big, 512 = huge)" placeholder="48" />
                </Section>
            </Scroll>
        );
    },
});
