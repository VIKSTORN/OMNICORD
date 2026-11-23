// Port of FakeDeafen: look muted + deafened in voice while still hearing and (optionally) talking.
import { Scroll, Section, Switch } from "../shared/ui";
import { before, findByProps, findByStoreName, omniPlugin, showToast, useProxy } from "../vd";

const defaults = { mute: true, deafen: true };
type S = typeof defaults;
let undo: (() => void)[] = [];

/** Resend the voice state so the change shows right away. */
function resend() {
    if (!findByStoreName("SelectedChannelStore")?.getVoiceChannelId?.()) return; // not in voice: nothing to update
    const A = findByProps("toggleSelfDeaf");
    try { A?.toggleSelfDeaf?.(); setTimeout(() => A?.toggleSelfDeaf?.(), 250); } catch { }
}

export default omniPlugin<S>({
    id: "fake-deafen",
    name: "Fake Deafen",
    description: "While on, others see you muted/deafened in voice but you still hear (toggle from Ω)",
    defaults,
    preenabled: false,
    start(s) {
        const G = findByProps("voiceStateUpdate", "requestGuildMembers") ?? findByProps("voiceStateUpdate");
        if (G) undo.push(before("voiceStateUpdate", G, (args: any[]) => {
            const v = args[0];
            if (!v || typeof v !== "object") return;
            if (s.mute) v.selfMute = true;
            if (s.deafen) v.selfDeaf = true;
        }));
        else showToast("Fake Deafen: not supported on this Discord version");
        resend();
    },
    stop() { undo.splice(0).forEach(u => u()); resend(); },
    Settings({ storage }) {
        useProxy(storage);
        return (
            <Scroll>
                <Section>
                    <Switch store={storage} k="mute" label="Show as muted" />
                    <Switch store={storage} k="deafen" label="Show as deafened" />
                </Section>
            </Scroll>
        );
    },
});
