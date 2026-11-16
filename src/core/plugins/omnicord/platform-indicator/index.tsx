import { Scroll, Switch } from "../shared/ui";
import { after, findByName, findByStoreName, omniPlugin, useProxy } from "../vd";

const defaults = { showStatus: true, showSelf: true, ignoreBots: true };
type S = typeof defaults;

const ICON: Record<string, string> = { desktop: "🖥️", mobile: "📱", web: "🌐", embedded: "🎮" };
const DOT: Record<string, string> = { online: "🟢", idle: "🟡", dnd: "🔴" };

let unpatch: (() => void) | undefined;

export default omniPlugin<S>({
    id: "platform-indicator",
    name: "Platform Indicator",
    description: "Shows which devices a user is online on next to their messages",
    defaults,
    start(s) {
        const RowManager = findByName("RowManager");
        const PresenceStore = findByStoreName("PresenceStore");
        const SessionsStore = findByStoreName("SessionsStore");
        const UserStore = findByStoreName("UserStore");

        const statuses = (userId: string): Record<string, string> | undefined => {
            if (userId === UserStore.getCurrentUser()?.id) {
                if (!s.showSelf) return;
                const out: Record<string, string> = {};
                for (const x of Object.values<any>(SessionsStore?.getSessions?.() ?? {})) {
                    const c = x?.clientInfo?.client;
                    if (c && c !== "unknown") out[c] = x.status ?? "online";
                }
                return out;
            }
            return PresenceStore.getState?.()?.clientStatuses?.[userId] ?? PresenceStore.getClientStatus?.(userId);
        };

        unpatch = after("generate", RowManager.prototype, ([data]: any[], row: any) => {
            if (data?.rowType !== 1) return;
            const author = data.message?.author;
            if (!author || (s.ignoreBots && author.bot)) return;
            const m = row?.message;
            if (!m || typeof m.timestamp !== "string") return;
            const st = statuses(author.id);
            if (!st) return;
            const tag = Object.entries(st)
                .filter(([p, v]) => ICON[p] && v && v !== "offline")
                .map(([p, v]) => (s.showStatus ? DOT[v] ?? "" : "") + ICON[p])
                .join(" ");
            if (tag) m.timestamp = `${tag}  ${m.timestamp}`;
        });
    },
    stop() { unpatch?.(); },
    Settings({ storage }) {
        useProxy(storage);
        return (
            <Scroll>
                <Switch store={storage} k="showStatus" label="Show status color" sub="🟢 online · 🟡 idle · 🔴 dnd per device" iconName="ic_status_online" />
                <Switch store={storage} k="showSelf" label="Show on my messages" iconName="ic_person" />
                <Switch store={storage} k="ignoreBots" label="Hide on bots" iconName="ic_robot_24px" />
            </Scroll>
        );
    },
});
