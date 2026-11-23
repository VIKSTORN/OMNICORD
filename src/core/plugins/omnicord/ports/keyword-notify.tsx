// Port of KeywordNotify: toast when a message contains one of your words.
import { Input, Scroll, Section, Switch } from "../shared/ui";
import { findByStoreName, FluxDispatcher, omniPlugin, showToast, useProxy } from "../vd";

const defaults = { words: "", caseSensitive: false, wholeWord: true, ignoreSelf: true };
type S = typeof defaults;
let undo: (() => void) | undefined;

const esc = (w: string) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export default omniPlugin<S>({
    id: "keyword-notify",
    name: "Keyword Notify",
    description: "Get a toast when any message contains your keywords",
    defaults,
    start(s) {
        const US = findByStoreName("UserStore");
        const CS = findByStoreName("ChannelStore");
        const h = (e: any) => {
            const m = e?.message;
            const words = s.words.split(",").map(w => w.trim()).filter(Boolean);
            if (!m?.content || !words.length || e.optimistic) return;
            if (s.ignoreSelf && m.author?.id === US.getCurrentUser()?.id) return;
            const re = new RegExp(words.map(w => s.wholeWord ? `(^|\\W)${esc(w)}(\\W|$)` : esc(w)).join("|"), s.caseSensitive ? "" : "i");
            if (!re.test(m.content)) return;
            const ch = CS.getChannel(m.channel_id);
            showToast(`${m.author?.globalName ?? m.author?.username} in ${ch?.name ? "#" + ch.name : "DMs"}: ${m.content.replace(/\s+/g, " ").slice(0, 70)}`);
        };
        FluxDispatcher.subscribe("MESSAGE_CREATE", h);
        undo = () => FluxDispatcher.unsubscribe("MESSAGE_CREATE", h);
    },
    stop() { undo?.(); },
    Settings({ storage }) {
        useProxy(storage);
        return (
            <Scroll>
                <Section>
                    <Input store={storage} k="words" title="Keywords (comma separated)" placeholder="omnicord, my name, giveaway" />
                    <Switch store={storage} k="wholeWord" label="Whole words only" />
                    <Switch store={storage} k="caseSensitive" label="Case sensitive" />
                    <Switch store={storage} k="ignoreSelf" label="Ignore my own messages" />
                </Section>
            </Scroll>
        );
    },
});
