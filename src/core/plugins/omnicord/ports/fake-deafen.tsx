// Port of FakeDeafen: look muted + deafened in voice while still hearing and (optionally) talking.
import { addQuickActions } from "../shared/quick";
import { Scroll, Section, Switch } from "../shared/ui";
import { before, findByProps, omniPlugin, showToast, useProxy } from "../vd";

const defaults = { on: false, mute: true, deafen: true };
type S = typeof defaults;
let undo: (() => void)[] = [];

/** Resend the voice state so the change shows right away. */
function resend() {
    const A = findByProps("toggleSelfDeaf");
    try { A?.toggleSelfDeaf?.(); setTimeout(() => A?.toggleSelfDeaf?.(), 250); } catch { }
}

export default omniPlugin<S>({
    id: "fake-deafen",
    name: "Fake Deafen",
    description: "Others see you muted/deafened in voice, you still hear everything",
    defaults,
    preenabled: false,
    start(s) {
        const G = findByProps("voiceStateUpdate", "requestGuildMembers") ?? findByProps("voiceStateUpdate");
        if (G) undo.push(before("voiceStateUpdate", G, (args: any[]) => {
            const v = args[0];
            if (!s.on || !v || typeof v !== "object") return;
            if (s.mute) v.selfMute = true;
            if (s.deafen) v.selfDeaf = true;
        }));
        else showToast("Fake Deafen: not supported on this Discord version");
        undo.push(addQuickActions({
            id: "fake-deafen", order: 72, keepOpen: true, icon: ["HeadphonesSlashIcon", "ic_headset_deafen", "HeadphonesIcon"],
            label: "Fake deafen", sub: () => s.on ? "Others see you deafened" : "Off",
            toggled: () => s.on, run: () => { s.on = !s.on; resend(); },
        }));
    },
    stop() { undo.splice(0).forEach(u => u()); },
    Settings({ storage }) {
        useProxy(storage);
        return (
            <Scroll>
                <Section>
                    <Switch store={storage} k="on" label="Fake deafen now" sub="Takes effect in voice right away" />
                    <Switch store={storage} k="mute" label="Show as muted" />
                    <Switch store={storage} k="deafen" label="Show as deafened" />
                </Section>
            </Scroll>
        );
    },
});
