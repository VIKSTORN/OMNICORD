// DM Bubbles: avatar-only DMs (no name line) + a soft tint per side (you vs them).
// Discord's native chat list only takes one flat color per row, so this is the closest bubble look possible.
import { Txt } from "@core/ui/components/SafeUI";

import { Input, Scroll, Section, Switch } from "../shared/ui";
import { after, findByName, findByStoreName, omniPlugin, ReactNative as RN, useProxy } from "../vd";

const defaults = {
    hideNames: true,
    tint: true,
    mineColor: "#5865f2", mineAlpha: 9,
    themColor: "#ffffff", themAlpha: 4,
    servers: false,
    cleanTime: true, // drop status / device icons before the time
    hideTime: false,
};
type S = typeof defaults;
const HEX = /^#([0-9a-f]{6})$/i;
const ZW = "​";
let undo: (() => void) | undefined;
const a2 = (p: number) => Math.round(Math.max(0, Math.min(100, p)) * 2.55).toString(16).padStart(2, "0");

export default omniPlugin<S>({
    id: "dm-bubbles",
    name: "DM Bubbles",
    description: "Avatar-only DMs with a soft tint for your side and theirs",
    defaults,
    start(s) {
        const RowManager = findByName("RowManager");
        const US = findByStoreName("UserStore");
        const CS = findByStoreName("ChannelStore");
        undo = after("generate", RowManager.prototype, ([data]: any[], row: any) => {
            if (data?.rowType !== 1 || !row?.message) return;
            const m = data.message;
            if (!m || (!s.servers && CS?.getChannel?.(m.channel_id)?.guild_id)) return;
            const rm = row.message;
            if (s.hideNames) {
                // Zero-width space, not "": an empty name falls back to the username on some builds.
                if (typeof rm.username === "string") rm.username = ZW;
                rm.usernameColor = undefined;
                for (const k of ["tagText", "opTagText", "roleIcon", "tagType", "tagVerified", "clanTag", "connectionsRoleTag", "avatarDecorationURL"]) if (k in rm) rm[k] = undefined;
                rm.__omniNoName = true;
            }
            if (typeof rm.timestamp === "string") {
                if (s.hideTime) rm.timestamp = ZW;
                else if (s.cleanTime) rm.timestamp = rm.timestamp.replace(/^[^\p{L}\p{N}]+/u, "");
            }
            if (s.cleanTime || s.hideTime) rm.__omniCleanTime = true;
            if (s.tint && !m.__eqm_deleted && !row.backgroundHighlight?.backgroundColor) {
                const mine = m.author?.id === US?.getCurrentUser?.()?.id;
                const c = mine ? s.mineColor : s.themColor, a = mine ? s.mineAlpha : s.themAlpha;
                if (HEX.test(c) && a > 0) {
                    row.backgroundHighlight ??= {};
                    row.backgroundHighlight.backgroundColor = RN.processColor(c + a2(a));
                }
            }
        });
    },
    stop() { undo?.(); },
    Settings({ storage }) {
        useProxy(storage);
        const Side = ({ title, ck, ak }: { title: string; ck: "mineColor" | "themColor"; ak: "mineAlpha" | "themAlpha"; }) => (
            <Section title={title}>
                <RN.View style={{ margin: 12, borderRadius: 12, padding: 10, backgroundColor: HEX.test(storage[ck]) ? storage[ck] + a2(storage[ak]) : "#0000" }}>
                    <Txt style={{ color: "#dbdee1", fontSize: 14 }}>Preview message</Txt>
                </RN.View>
                <RN.View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, paddingHorizontal: 12, paddingBottom: 8 }}>
                    {["#ffffff", "#5865f2", "#23a55a", "#eb459e", "#00b4d8", "#f0b232", "#9b59b6", "#000000"].map(c => (
                        <RN.Pressable key={c} onPress={() => void (storage[ck] = c)} style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: c, borderWidth: storage[ck] === c ? 2 : 1, borderColor: storage[ck] === c ? "#fff" : "#8888" }} />
                    ))}
                </RN.View>
                <Input store={storage} k={ck} title="Color (hex #rrggbb)" placeholder="#5865f2" />
                <RN.View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 8 }}>
                    <Txt style={{ color: "#dbdee1", fontSize: 15, flex: 1 }}>Strength: {storage[ak]}%</Txt>
                    {[-1, 1].map(d => (
                        <RN.Pressable key={d} onPress={() => void (storage[ak] = Math.max(0, Math.min(40, storage[ak] + d * 2)))} style={{ backgroundColor: "#4e505888", borderRadius: 8, paddingHorizontal: 14, paddingVertical: 6, marginLeft: 8 }}>
                            <Txt style={{ color: "#fff", fontSize: 16 }}>{d < 0 ? "−" : "+"}</Txt>
                        </RN.Pressable>
                    ))}
                </RN.View>
            </Section>
        );
        return (
            <Scroll>
                <Txt style={{ color: "#949ba4", fontSize: 12, paddingHorizontal: 4 }}>Re-open the chat to see changes. Message Highlights rules (mentions, keywords…) win over the tint.</Txt>
                <Section>
                    <Switch store={storage} k="hideNames" label="Avatar only" sub="No name line, just the picture" />
                    <Switch store={storage} k="tint" label="Bubble tint" sub="Soft color behind each side" />
                    <Switch store={storage} k="cleanTime" label="Clean time" sub="No status / device icons next to the time" />
                    <Switch store={storage} k="hideTime" label="Hide time" sub="Nothing on the header line" />
                    <Switch store={storage} k="servers" label="Also in servers" sub="Off = DMs and group DMs only" />
                </Section>
                {storage.tint ? <><Side title="My messages" ck="mineColor" ak="mineAlpha" /><Side title="Their messages" ck="themColor" ak="themAlpha" /></> : null}
            </Scroll>
        );
    },
});
