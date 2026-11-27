// Message Highlights: tint message rows (with a colored bar on the left) for your messages, mentions,
// friends, chosen people and keywords. Closest thing to chat bubbles on Discord's native chat list.
import { Txt } from "@core/ui/components/SafeUI";

import { Input, Scroll, Section } from "../shared/ui";
import { after, findByName, findByStoreName, omniPlugin, ReactNative as RN, useProxy } from "../vd";

type Rule = { on: boolean; color: string; alpha: number; bar: boolean; };
const rule = (on: boolean, color: string, alpha = 14): Rule => ({ on, color, alpha, bar: false });
const defaults = {
    mine: rule(true, "#5865f2", 10),
    mention: rule(true, "#f0b232", 16),
    friends: rule(false, "#23a55a", 8),
    users: rule(false, "#eb459e", 14), userList: "",
    keywords: rule(false, "#00b4d8", 14), keywordList: "",
    hideNames: false,   // avatar only, no name line (experimental)
    v2: false,
};
type S = typeof defaults;
const HEX = /^#([0-9a-f]{6})$/i;
let undo: (() => void) | undefined;

export default omniPlugin<S>({
    id: "message-highlights",
    name: "Message Highlights",
    description: "Soft color glow on your messages, mentions, friends, chosen people, keywords · avatar-only chat",
    defaults,
    start(s) {
        if (!s.v2) { for (const k of ["mine", "mention", "friends", "users", "keywords"] as const) s[k] = { ...s[k], bar: false }; s.v2 = true; }
        const RowManager = findByName("RowManager");
        const US = findByStoreName("UserStore");
        const RS = findByStoreName("RelationshipStore");
        undo = after("generate", RowManager.prototype, ([data]: any[], row: any) => {
            if (data?.rowType !== 1 || !row?.message) return;
            const m = data.message;
            if (s.hideNames) {
                // Clean chat: keep the avatar, drop the name line and its tags.
                const rm = row.message;
                if (typeof rm.username === "string") rm.username = "";
                for (const k of ["tagText", "opTagText", "roleIcon", "tagType", "clanTag", "connectionsRoleTag"]) if (k in rm) rm[k] = undefined;
            }
            if (!m || m.__eqm_deleted) return; // message logger paints deleted ones red
            const me = US.getCurrentUser()?.id;
            const aid = m.author?.id;
            const list = (t: string) => t.split(",").map(x => x.trim().toLowerCase()).filter(Boolean);
            const content = String(m.content ?? "").toLowerCase();
            const pick: Rule | undefined =
                s.mention.on && aid !== me && ((m.mentions ?? []).some((u: any) => (u?.id ?? u) === me) || m.mentionEveryone) ? s.mention
                    : s.keywords.on && list(s.keywordList).some(k => content.includes(k)) ? s.keywords
                        : s.users.on && aid && list(s.userList).some(u => u === aid || u === m.author?.username?.toLowerCase()) ? s.users
                            : s.friends.on && aid && RS?.isFriend?.(aid) ? s.friends
                                : s.mine.on && aid === me ? s.mine : undefined;
            if (!pick || !HEX.test(pick.color)) return;
            const a = Math.round(Math.max(0, Math.min(100, pick.alpha)) * 2.55).toString(16).padStart(2, "0");
            row.backgroundHighlight ??= {};
            row.backgroundHighlight.backgroundColor = RN.processColor(pick.color + a);
            if (pick.bar) row.backgroundHighlight.gutterColor = RN.processColor(pick.color + "ff");
        });
    },
    stop() { undo?.(); },
    Settings({ storage }) {
        useProxy(storage);
        const Rule = ({ k, title, children }: { k: "mine" | "mention" | "friends" | "users" | "keywords"; title: string; children?: any; }) => {
            const r = storage[k];
            const set = (p: Partial<Rule>) => void (storage[k] = { ...r, ...p });
            return (
                <Section title={title}>
                    <RN.View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 10 }}>
                        <Txt style={{ color: "#dbdee1", fontSize: 16, flex: 1 }}>Highlight these</Txt>
                        <RN.Switch value={r.on} onValueChange={v => set({ on: v })} />
                    </RN.View>
                    {r.on ? <>
                        <RN.View style={{ margin: 12, borderRadius: 8, overflow: "hidden", flexDirection: "row", backgroundColor: HEX.test(r.color) ? r.color + Math.round(r.alpha * 2.55).toString(16).padStart(2, "0") : "#0000" }}>
                            {r.bar ? <RN.View style={{ width: 3, backgroundColor: HEX.test(r.color) ? r.color : "#888" }} /> : null}
                            <Txt style={{ color: "#dbdee1", padding: 10, fontSize: 14 }}>Preview message</Txt>
                        </RN.View>
                        <RN.View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, paddingHorizontal: 12, paddingBottom: 8 }}>
                            {["#5865f2", "#f0b232", "#23a55a", "#eb459e", "#00b4d8", "#da373c", "#ffffff", "#9b59b6"].map(c => (
                                <RN.Pressable key={c} onPress={() => set({ color: c })} style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: c, borderWidth: r.color === c ? 2 : 0, borderColor: "#fff" }} />
                            ))}
                        </RN.View>
                        <Input store={{ get color() { return r.color; }, set color(v: string) { set({ color: v.trim() }); } }} k="color" title="Color (hex #rrggbb)" placeholder="#5865f2" />
                        <RN.View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 8 }}>
                            <Txt style={{ color: "#dbdee1", fontSize: 15, flex: 1 }}>Strength: {r.alpha}%</Txt>
                            {[-4, 4].map(d => (
                                <RN.Pressable key={d} onPress={() => set({ alpha: Math.max(2, Math.min(60, r.alpha + d)) })} style={{ backgroundColor: "#4e505888", borderRadius: 8, paddingHorizontal: 14, paddingVertical: 6, marginLeft: 8 }}>
                                    <Txt style={{ color: "#fff", fontSize: 16 }}>{d < 0 ? "−" : "+"}</Txt>
                                </RN.Pressable>
                            ))}
                        </RN.View>
                        <RN.View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingBottom: 8 }}>
                            <Txt style={{ color: "#dbdee1", fontSize: 15, flex: 1 }}>Bar on the left (off = soft glow only)</Txt>
                            <RN.Switch value={r.bar} onValueChange={v => set({ bar: v })} />
                        </RN.View>
                        {children}
                    </> : null}
                </Section>
            );
        };
        return (
            <Scroll>
                <Txt style={{ color: "#949ba4", fontSize: 12, paddingHorizontal: 4 }}>New colors show on messages as they load (re-open the chat).</Txt>
                <Section title="Chat style">
                    <RN.View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 10 }}>
                        <RN.View style={{ flex: 1 }}>
                            <Txt style={{ color: "#dbdee1", fontSize: 16 }}>Avatar only (hide names)</Txt>
                            <Txt style={{ color: "#949ba4", fontSize: 12 }}>Experimental: cleaner, bubble-like chat. Re-open the chat.</Txt>
                        </RN.View>
                        <RN.Switch value={!!storage.hideNames} onValueChange={v => void (storage.hideNames = v)} />
                    </RN.View>
                </Section>
                <Rule k="mine" title="My messages" />
                <Rule k="mention" title="Mentions of me" />
                <Rule k="friends" title="Friends" />
                <Rule k="users" title="Chosen people"><Input store={storage} k="userList" title="User IDs or usernames, comma separated" placeholder="123456789, felborn" /></Rule>
                <Rule k="keywords" title="Keywords"><Input store={storage} k="keywordList" title="Words, comma separated" placeholder="omnicord, giveaway" /></Rule>
            </Scroll>
        );
    },
});
