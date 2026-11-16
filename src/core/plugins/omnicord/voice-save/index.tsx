import { hideSheet, makeRow, patchMessageSheet } from "../shared/actionSheet";
import { icon } from "../shared/ui";
import { clipboard, findByProps, logger, omniPlugin, showToast, url as Url } from "../vd";

const VOICE_FLAG = 8192;

function audioOf(message: any) {
    const atts: any[] = message.attachments ?? [];
    const isVoice = ((message.flags ?? 0) & VOICE_FLAG) !== 0;
    return atts.find(a => isVoice || String(a.content_type ?? a.contentType ?? "").startsWith("audio")
        || /\.(ogg|opus|mp3|m4a|wav|flac|aac)$/i.test(a.filename ?? ""));
}

async function save(a: any) {
    hideSheet();
    const link = a.url ?? a.proxy_url;
    try {
        await findByProps("downloadMediaAsset").downloadMediaAsset(link, 0);
        showToast("Saving voice message…", icon("ic_download_24px"));
    } catch (e) {
        // Some builds refuse non-image/video types: hand it to the browser/download manager instead.
        logger.warn("downloadMediaAsset failed, opening in browser", e);
        Url.openURL(link);
    }
}

let unpatch: (() => void) | undefined;

export default omniPlugin({
    id: "voice-save",
    name: "Save Voice Notes",
    description: "Long-press a voice message > Save / Copy link",
    start() {
        unpatch = patchMessageSheet(message => {
            const a = audioOf(message);
            if (!a) return;
            return [
                makeRow("Save voice message", icon("ic_download_24px"), () => save(a), "eqm-vsave"),
                makeRow("Copy voice message link", icon("copy"), () => {
                    hideSheet();
                    clipboard.setString(a.url ?? a.proxy_url);
                    showToast("Copied link", icon("check"));
                }, "eqm-vcopy"),
            ];
        });
    },
    stop() { unpatch?.(); },
});
