// Port of GhostPing detection: tells you who pinged you and then deleted the message.
import { Scroll, Section, Switch } from "../shared/ui";
import { before, findByStoreName, FluxDispatcher, omniPlugin, showToast, useProxy } from "../vd";

const defaults = { roles: true, everyone: false };
type S = typeof defaults;
let undo: (() => void) | undefined;

export default omniPlugin<S>({
    id: "ghost-ping",
    name: "Ghost Ping Detector",
    description: "Toast when someone pings you then deletes the message",
    defaults,
    start(s) {
        const MS = findByStoreName("MessageStore");
        const US = findByStoreName("UserStore");
        const CS = findByStoreName("ChannelStore");
        const GMS = findByStoreName("GuildMemberStore");
        undo = before("dispatch", FluxDispatcher, (args: any[]) => {
            const ev = args[0];
            if (ev?.type !== "MESSAGE_DELETE") return;
            try {
                const m = MS.getMessage(ev.channelId, ev.id);
                const me = US.getCurrentUser()?.id;
                if (!m || !me || m.author?.id === me) return;
                const ch = CS.getChannel(ev.channelId);
                const myRoles: string[] = ch?.guild_id ? GMS?.getMember?.(ch.guild_id, me)?.roles ?? [] : [];
                const direct = (m.mentions ?? []).some((u: any) => (u?.id ?? u) === me);
                const role = s.roles && (m.mentionRoles ?? m.mention_roles ?? []).some((r: string) => myRoles.includes(r));
                const all = s.everyone && (m.mentionEveryone ?? m.mention_everyone);
                if (!direct && !role && !all) return;
                const who = m.author?.globalName ?? m.author?.username ?? "Someone";
                const where = ch?.name ? `#${ch.name}` : "DMs";
                const text = String(m.content ?? "").replace(/\s+/g, " ").slice(0, 60);
                showToast(`Ghost ping by ${who} in ${where}${text ? `: ${text}` : ""}`);
            } catch { }
        });
    },
    stop() { undo?.(); },
    Settings({ storage }) {
        useProxy(storage);
        return (
            <Scroll>
                <Section>
                    <Switch store={storage} k="roles" label="Count role pings" />
                    <Switch store={storage} k="everyone" label="Count @everyone / @here" />
                </Section>
            </Scroll>
        );
    },
});
