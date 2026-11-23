// Port of NoReplyMention: replies don't ping by default.
import { Scroll, Section, Switch } from "../shared/ui";
import { before, findByProps, omniPlugin, useProxy } from "../vd";

const defaults = { enabled: true };
type S = typeof defaults;
let undo: (() => void) | undefined;

export default omniPlugin<S>({
    id: "no-reply-mention",
    name: "No Reply Mention",
    description: "Replies don't ping the person you reply to",
    defaults,
    preenabled: false,
    start(s) {
        const M = findByProps("sendMessage", "receiveMessage");
        undo = before("sendMessage", M, (args: any[]) => {
            const opts = args[3];
            if (!s.enabled || !opts?.messageReference) return;
            opts.allowedMentions = { parse: ["users", "roles", "everyone"], replied_user: false };
        });
    },
    stop() { undo?.(); },
    Settings({ storage }) {
        useProxy(storage);
        return <Scroll><Section><Switch store={storage} k="enabled" label="Don't ping when replying" /></Section></Scroll>;
    },
});
