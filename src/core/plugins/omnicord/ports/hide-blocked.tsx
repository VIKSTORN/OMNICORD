// Port of NoBlockedMessages: messages from people you blocked don't show at all.
import { Scroll, Section, Switch } from "../shared/ui";
import { before, findByStoreName, FluxDispatcher, omniPlugin, useProxy } from "../vd";

const defaults = { ignored: false };
type S = typeof defaults;
let undo: (() => void) | undefined;

export default omniPlugin<S>({
    id: "hide-blocked",
    name: "Hide Blocked Messages",
    description: "Messages from blocked (and optionally ignored) users are removed instead of collapsed",
    defaults,
    preenabled: false,
    start(s) {
        const RS = findByStoreName("RelationshipStore");
        const hidden = (m: any) => {
            const id = m?.author?.id;
            return !!id && (RS?.isBlocked?.(id) || (s.ignored && RS?.isIgnored?.(id)));
        };
        undo = before("dispatch", FluxDispatcher, (args: any[]) => {
            const ev = args[0];
            if (!ev) return;
            if (ev.type === "MESSAGE_CREATE" && hidden(ev.message)) { args[0] = { ...ev, type: "OMNI_HIDDEN_MESSAGE" }; return args; }
            if ((ev.type === "LOAD_MESSAGES_SUCCESS" || ev.type === "LOAD_MESSAGES_AROUND_SUCCESS") && Array.isArray(ev.messages))
                ev.messages = ev.messages.filter((m: any) => !hidden(m));
        });
    },
    stop() { undo?.(); },
    Settings({ storage }) {
        useProxy(storage);
        return <Scroll><Section><Switch store={storage} k="ignored" label="Also hide ignored users" sub="Re-open the chat after changing" /></Section></Scroll>;
    },
});
