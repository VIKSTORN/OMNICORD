// Same mechanism as Vencord's ReadAllNotificationsButton: BULK_ACK.
import { addQuickActions } from "../shared/quick";
import { icon, Row, Scroll, Section, Switch } from "../shared/ui";
import { findByProps, findByStoreName, FluxDispatcher, omniPlugin, registerCommand, showConfirmationAlert, showToast, useProxy } from "../vd";

const defaults = { includeDMs: false, confirm: true };
type S = typeof defaults;

function readAll(includeDMs: boolean) {
    const GuildStore = findByStoreName("GuildStore");
    const GuildChannelStore = findByStoreName("GuildChannelStore");
    const ReadStateStore = findByStoreName("ReadStateStore");
    const ChannelStore = findByStoreName("ChannelStore");
    const ThreadsStore = findByStoreName("ActiveJoinedThreadsStore");

    const ids = new Set<string>();
    for (const guildId of Object.keys(GuildStore.getGuilds() ?? {})) {
        const gc = GuildChannelStore.getChannels(guildId) ?? {};
        for (const c of [...(gc.SELECTABLE ?? []), ...(gc.VOCAL ?? [])]) c?.channel?.id && ids.add(c.channel.id);
        for (const byParent of Object.values<any>(ThreadsStore?.getActiveJoinedThreadsForGuild?.(guildId) ?? {}))
            for (const t of Object.values<any>(byParent ?? {})) t?.channel?.id && ids.add(t.channel.id);
    }
    if (includeDMs) {
        const dms = ChannelStore.getSortedPrivateChannels?.() ?? Object.values(ChannelStore.getMutablePrivateChannels?.() ?? {});
        for (const c of dms) c?.id && ids.add(c.id);
    }
    const unread = [...ids].filter(id => ReadStateStore.hasUnread(id) || ReadStateStore.getMentionCount?.(id) > 0);
    const mentions = unread.reduce((n, id) => n + (ReadStateStore.getMentionCount?.(id) ?? 0), 0);
    const channels = unread.map(channelId => ({ channelId, messageId: ReadStateStore.lastMessageId(channelId), readStateType: 0 }));
    for (let i = 0; i < channels.length; i += 100)
        FluxDispatcher.dispatch({ type: "BULK_ACK", context: "APP", channels: channels.slice(i, i + 100) } as any);
    return { count: channels.length, mentions };
}

let unregister: (() => void) | undefined;
let unquick: (() => void) | undefined;

function runWithConfirm(storage: S) {
    const go = () => {
        const { count, mentions } = readAll(storage.includeDMs);
        showToast(count ? `Marked ${count} channels read (${mentions} mentions)` : "Nothing unread", icon("check"));
    };
    if (!storage.confirm) return go();
    showConfirmationAlert({
        title: "Read all messages?",
        content: `Mark every server channel${storage.includeDMs ? " and DM" : ""} as read.`,
        confirmText: "Read all",
        onConfirm: go,
    });
}

export default omniPlugin<S>({
    id: "read-all",
    name: "Read All Messages",
    description: "Mark every channel, thread (and optionally DM) as read: /readall or the button in settings",
    defaults,
    start(s) {
        unquick = addQuickActions({
            id: "read-all", order: 10,
            label: "✅ Read all",
            sub: () => `Mark every server channel${s.includeDMs ? " + DMs" : ""} as read`,
            run: () => runWithConfirm(s),
        });
        unregister = registerCommand({
            name: "readall",
            displayName: "readall",
            description: "Mark all channels as read",
            displayDescription: "Mark all channels as read",
            options: [{ name: "dms", displayName: "dms", description: "Include DMs", displayDescription: "Include DMs", type: 5, required: false }],
            applicationId: "-1",
            inputType: 1,
            type: 1,
            execute(args: any[], ctx: any) {
                const { count, mentions } = readAll(args.find(a => a.name === "dms")?.value ?? s.includeDMs);
                findByProps("sendBotMessage").sendBotMessage(ctx.channel.id, count ? `✅ Marked ${count} channels as read (${mentions} mentions cleared).` : "Nothing unread.");
            },
        } as any);
    },
    stop() { unregister?.(); unquick?.(); },
    Settings({ storage }) {
        useProxy(storage);
        const run = () => runWithConfirm(storage);
        return (
            <Scroll>
                <Section>
                    <Row label="✅ Read all now" sub="Also: /readall or the Ω button" onPress={run} />
                </Section>
                <Section title="Options">
                    <Switch store={storage} k="includeDMs" label="Include DMs" />
                    <Switch store={storage} k="confirm" label="Ask before marking read" />
                </Section>
            </Scroll>
        );
    },
});
