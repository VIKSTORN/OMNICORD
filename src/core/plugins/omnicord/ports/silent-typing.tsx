// Port of Equicord/Vencord SilentTyping: others don't see "… is typing".
import { Scroll, Section, Switch } from "../shared/ui";
import { findByProps, instead, omniPlugin, useProxy } from "../vd";

const defaults = { enabled: true };
type S = typeof defaults;
let undo: (() => void)[] = [];

export default omniPlugin<S>({
    id: "silent-typing",
    name: "Silent Typing",
    description: "Hide that you're typing",
    defaults,
    preenabled: false,
    start(s) {
        const T = findByProps("startTyping", "stopTyping");
        if (T) undo.push(instead("startTyping", T, (a: any[], o: any) => s.enabled ? undefined : o(...a)));
    },
    stop() { undo.splice(0).forEach(u => u()); },
    Settings({ storage }) {
        useProxy(storage);
        return <Scroll><Section><Switch store={storage} k="enabled" label="Hide typing indicator" /></Section></Scroll>;
    },
});
