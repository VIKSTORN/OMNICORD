// Approach from redstonekasi's message-logger: MESSAGE_DELETE -> MESSAGE_UPDATE flagged as deleted.
import { Scroll, Section, Switch } from "../shared/ui";
import { after, before, findByName, findByProps, findByStoreName, FluxDispatcher, instead, omniPlugin, ReactNative, useProxy } from "../vd";

const defaults = { logDeletes: true, logEdits: true, ignoreBots: false, ignoreSelf: false };
type S = typeof defaults;

const real = new Map<string, string>();      // id -> real current content
const history = new Map<string, string[]>(); // id -> previous contents
let patches: (() => void)[] = [];

const quote = (t: string) => t.split("\n").map(l => `-# ✏️ ${l || " "}`).join("\n");
const withHistory = (id: string, content: string) => [content, ...(history.get(id) ?? []).map(quote)].join("\n");

export default omniPlugin<S>({
    id: "message-logger",
    name: "Message Logger",
    description: "Deleted messages stay (red), edits keep their old versions",
    defaults,
    start(s) {
        const ChannelMessages = findByProps("_channelMessages");
        const RecordUtils = findByProps("updateMessageRecord", "createMessageRecord");
        const MessageRecord = findByName("MessageRecord", false);
        const RowManager = findByName("RowManager");
        const UserStore = findByStoreName("UserStore");

        const ignored = (m: any) => !m || m.author?.id === "1" || m.state === "SEND_FAILED"
            || (s.ignoreBots && m.author?.bot)
            || (s.ignoreSelf && m.author?.id === UserStore.getCurrentUser()?.id);

        patches.push(before("dispatch", FluxDispatcher, (args: any[]) => {
            const ev = args[0];
            if (!ev || ev.__eqm_cleanup) return;

            if (ev.type === "MESSAGE_DELETE" && s.logDeletes) {
                const msg = ChannelMessages.get(ev.channelId)?.get(ev.id);
                if (ignored(msg)) return;
                args[0] = { type: "MESSAGE_UPDATE", message: { ...msg.toJS(), __eqm_deleted: true }, log_edit: false };
                return args;
            }

            if (ev.type === "MESSAGE_UPDATE" && s.logEdits) {
                if (ev.__eqm_internal || ev.otherPluginBypass || ev.log_edit === false) return;
                const m = ev.message;
                if (typeof m?.content !== "string") return;
                const old = ChannelMessages.get(m.channel_id)?.get(m.id);
                if (ignored(old ?? m)) return;
                const prev = real.get(m.id) ?? old?.content;
                if (prev == null || prev === m.content) {
                    if (history.has(m.id)) m.content = withHistory(m.id, m.content);
                    return;
                }
                history.set(m.id, [...(history.get(m.id) ?? []), prev]);
                real.set(m.id, m.content);
                m.content = withHistory(m.id, m.content);
            }
        }));

        patches.push(after("generate", RowManager.prototype, ([data]: any[], row: any) => {
            if (data?.rowType !== 1 || !data.message?.__eqm_deleted) return;
            row.message.edited = "deleted";
            row.backgroundHighlight ??= {};
            row.backgroundHighlight.backgroundColor = ReactNative.processColor("#da373c22");
            row.backgroundHighlight.gutterColor = ReactNative.processColor("#da373cff");
        }));
        patches.push(instead("updateMessageRecord", RecordUtils, function (this: any, [oldRec, newRec]: any[], orig: any) {
            if (newRec.__eqm_deleted) return RecordUtils.createMessageRecord(newRec, oldRec.reactions);
            return orig.apply(this, [oldRec, newRec]);
        }));
        patches.push(after("createMessageRecord", RecordUtils, ([m]: any[], rec: any) => void (rec.__eqm_deleted = m.__eqm_deleted)));
        patches.push(after("default", MessageRecord, ([props]: any[], rec: any) => void (rec.__eqm_deleted = !!props.__eqm_deleted)));
    },
    stop() {
        patches.splice(0).forEach(p => p());
        const ChannelMessages = findByProps("_channelMessages");
        for (const cid in ChannelMessages._channelMessages) {
            for (const m of ChannelMessages._channelMessages[cid]._array ?? []) {
                if (m.__eqm_deleted) {
                    FluxDispatcher.dispatch({ type: "MESSAGE_DELETE", id: m.id, channelId: m.channel_id, __eqm_cleanup: true } as any);
                } else if (real.has(m.id)) {
                    FluxDispatcher.dispatch({ type: "MESSAGE_UPDATE", message: { id: m.id, channel_id: m.channel_id, content: real.get(m.id) }, log_edit: false, __eqm_cleanup: true } as any);
                }
            }
        }
        real.clear();
        history.clear();
    },
    Settings({ storage }) {
        useProxy(storage);
        return (
            <Scroll>
                <Section title="Log">
                    <Switch store={storage} k="logDeletes" label="Log deleted messages" />
                    <Switch store={storage} k="logEdits" label="Log edits" sub="Old versions shown under the message" />
                </Section>
                <Section title="Ignore">
                    <Switch store={storage} k="ignoreBots" label="Ignore bots" />
                    <Switch store={storage} k="ignoreSelf" label="Ignore my own messages" />
                </Section>
            </Scroll>
        );
    },
});
