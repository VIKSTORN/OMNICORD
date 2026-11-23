// Port of RelationshipNotifier: tells you when someone unfriends you, cancels a request, or you lose a server.
import { Scroll, Section, Switch } from "../shared/ui";
import { before, findByProps, findByStoreName, FluxDispatcher, logger, omniPlugin, showToast, useProxy } from "../vd";

const defaults = { friends: true, requests: true, servers: true };
type S = typeof defaults;
let undo: (() => void)[] = [];
const leaving = new Set<string>(); // servers/friends you removed yourself

export default omniPlugin<S>({
    id: "relationship-notifier",
    name: "Relationship Notifier",
    description: "Toast when a friend removes you, a request is cancelled, or you're removed from a server",
    defaults,
    start(s) {
        const RS = findByStoreName("RelationshipStore");
        const US = findByStoreName("UserStore");
        const GS = findByStoreName("GuildStore");
        const name = (id: string) => { const u = US?.getUser?.(id); return u ? (u.globalName ?? u.username) : `user ${id}`; };
        const sub = (type: string, fn: (e: any) => void) => {
            const h = (e: any) => { try { fn(e); } catch (err) { logger.error("relationship notifier", err); } };
            FluxDispatcher.subscribe(type, h);
            undo.push(() => FluxDispatcher.unsubscribe(type, h));
        };
        // Remember what was there before so we can name it after it's gone.
        const guildNames = new Map<string, string>();
        sub("GUILD_DELETE", e => {
            const id = e.guild?.id;
            if (!s.servers || !id || e.guild?.unavailable || leaving.delete(id)) return;
            showToast(`You were removed from ${GS?.getGuild?.(id)?.name ?? guildNames.get(id) ?? "a server"}`);
        });
        const GA = findByProps("leaveGuild");
        if (GA) undo.push(before("leaveGuild", GA, (a: any[]) => void leaving.add(String(a[0]))));
        const RA = findByProps("removeRelationship");
        if (RA) undo.push(before("removeRelationship", RA, (a: any[]) => void leaving.add(String(a[0]))));
        sub("GUILD_CREATE", e => e.guild?.id && guildNames.set(e.guild.id, e.guild.name));
        sub("RELATIONSHIP_REMOVE", e => {
            const r = e.relationship ?? {};
            const id = r.id ?? r.user?.id;
            if (!id || leaving.delete(id)) return;
            const type = r.type ?? RS?.getRelationshipType?.(id);
            if (type === 1 && s.friends) showToast(`${name(id)} removed you as a friend`);
            else if (type === 3 && s.requests) showToast(`${name(id)} cancelled their friend request`);
            else if (type === 4 && s.requests) showToast(`${name(id)} declined your friend request`);
        });
        try { for (const g of Object.values<any>(GS?.getGuilds?.() ?? {})) guildNames.set(g.id, g.name); } catch { }
    },
    stop() { undo.splice(0).forEach(u => u()); },
    Settings({ storage }) {
        useProxy(storage);
        return (
            <Scroll>
                <Section>
                    <Switch store={storage} k="friends" label="Friend removed you" />
                    <Switch store={storage} k="requests" label="Friend request cancelled / declined" />
                    <Switch store={storage} k="servers" label="Removed from a server" />
                </Section>
            </Scroll>
        );
    },
});
