// Idea from dziurwa14's customVoiceMessages: flag the upload as a voice message (flags 8192).
import { Input, Scroll, Section, Switch } from "../shared/ui";
import { findByProps, instead, logger, omniPlugin, useProxy } from "../vd";

const defaults = { enabled: true, fallbackSecs: "60" };
type S = typeof defaults;

const VOICE_FLAG = 8192;
const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const b64 = (bytes: number[]) => {
    let out = "";
    for (let i = 0; i < bytes.length; i += 3) {
        const [a, b = 0, c = 0] = [bytes[i], bytes[i + 1], bytes[i + 2]];
        const n = (a << 16) | (b << 8) | c;
        out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63]
            + (i + 1 < bytes.length ? B64[(n >> 6) & 63] : "=")
            + (i + 2 < bytes.length ? B64[n & 63] : "=");
    }
    return out;
};

const DEFAULT_WAVE = "AEtWPyUaGA4OEAcA";

/** Ogg/Opus duration = last page granule position / 48000. */
function oggDuration(buf: Uint8Array): number | undefined {
    if (!(buf[0] === 0x4f && buf[1] === 0x67 && buf[2] === 0x67 && buf[3] === 0x53)) return; // not Ogg
    for (let i = buf.length - 27; i >= 0; i--) {
        if (buf[i] === 0x4f && buf[i + 1] === 0x67 && buf[i + 2] === 0x67 && buf[i + 3] === 0x53) {
            let g = 0;
            for (let j = 7; j >= 0; j--) g = g * 256 + buf[i + 6 + j];
            if (g > 0 && g < 2 ** 52) return g / 48000; // -1 granule = page without packet end, keep looking
        }
    }
}

/** Fake-but-plausible waveform: chunk energy of the file bytes, 0..255, 64 bars. */
function waveform(buf: Uint8Array): string {
    const bars = 64, size = Math.max(1, Math.floor(buf.length / bars)), out: number[] = [];
    for (let b = 0; b < bars; b++) {
        let sum = 0;
        for (let i = b * size; i < (b + 1) * size && i < buf.length; i += 16) sum += Math.abs(buf[i] - 128);
        out.push(Math.min(255, Math.round((sum / (size / 16)) * 2)));
    }
    return b64(out);
}

async function analyse(uri: string) {
    try {
        const buf = new Uint8Array(await (await fetch(uri)).arrayBuffer());
        return { secs: oggDuration(buf), wave: waveform(buf) };
    } catch (e) {
        logger.warn("voice-send: could not read file", e);
        return {};
    }
}

let unpatch: (() => void) | undefined;

export default omniPlugin<S>({
    id: "voice-send",
    name: "Send Audio as Voice Note",
    description: "Audio files you upload are sent as voice messages",
    defaults,
    start(s) {
        const Uploader = findByProps("uploadLocalFiles");
        unpatch = instead("uploadLocalFiles", Uploader, (args: any[], orig: any) => {
            const opts = args[0];
            const items: any[] = opts?.items ?? [];
            const audio = items.length === 1 && String(items[0]?.mimeType ?? "").startsWith("audio");
            if (!s.enabled || !audio || (opts.flags & VOICE_FLAG)) return orig(...args);

            const item = items[0];
            const uri = item.item?.uri ?? item.uri;
            return analyse(uri).then(({ secs, wave }) => {
                const dur = secs ?? item.durationSecs ?? item.item?.durationSecs ?? (Number(s.fallbackSecs) || 60);
                item.mimeType = "audio/ogg";
                item.waveform = wave ?? DEFAULT_WAVE;
                item.durationSecs = dur;
                if (item.item) { item.item.waveform = item.waveform; item.item.durationSecs = dur; }
                opts.flags = (opts.flags ?? 0) | VOICE_FLAG;
                return orig(...args);
            });
        });
    },
    stop() { unpatch?.(); },
    Settings({ storage }) {
        useProxy(storage);
        return (
            <Scroll>
                <Section>
                    <Switch store={storage} k="enabled" label="Send audio files as voice notes" sub="Pick an audio file in the attachment menu and send. .ogg/.opus work best." />
                    <Input store={storage} k="fallbackSecs" title="Duration shown when it can't be read (seconds)" placeholder="60" />
                </Section>
            </Scroll>
        );
    },
});
