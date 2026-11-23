// Port of ClearURLs: strips tracking junk (utm_*, fbclid, si, …) from links you send.
import { Scroll, Section, Switch } from "../shared/ui";
import { before, findByProps, omniPlugin, useProxy } from "../vd";

const defaults = { enabled: true };
type S = typeof defaults;
let undo: (() => void)[] = [];

const GLOBAL = [/^utm_/, /^(fbclid|gclid|dclid|gbraid|wbraid|msclkid|mc_eid|mc_cid|igshid|igsh|yclid|_ga|_gl|ref_src|ref_url|si|spm|share_id|trk|trackingId|wt_mc|s_cid|cmpid|feature|pp)$/i];
const PER_SITE: [RegExp, RegExp][] = [
    [/(^|\.)amazon\./, /^(ref|psc|pd_rd_\w+|pf_rd_\w+|qid|sr|crid|sprefix|keywords|th|linkCode|tag|content-id|dib|dib_tag)$/],
    [/(^|\.)(twitter|x)\.com$/, /^(s|t|ref_src)$/],
    [/(^|\.)tiktok\.com$/, /^(_r|_t|is_from_webapp|sender_device|sender_web_id|share_app_id|share_item_id|share_link_id|u_code|tt_from|checksum|sec_uid|lang)$/],
    [/(^|\.)reddit\.com$/, /^(share_id|rdt|context|utm_\w+)$/],
    [/(^|\.)youtube\.com$|^youtu\.be$/, /^(si|feature|pp)$/],
    [/(^|\.)spotify\.com$/, /^(si|context|nd)$/],
    [/(^|\.)instagram\.com$/, /^(igsh|igshid|img_index)$/],
];

export function cleanUrl(raw: string) {
    try {
        const u = new URL(raw);
        const host = u.hostname.toLowerCase();
        const site = PER_SITE.filter(([h]) => h.test(host)).map(([, p]) => p);
        let changed = false;
        for (const k of [...u.searchParams.keys()]) {
            if (GLOBAL.some(r => r.test(k)) || site.some(r => r.test(k))) { u.searchParams.delete(k); changed = true; }
        }
        return changed ? u.toString().replace(/\?$/, "") : raw;
    } catch { return raw; }
}

export default omniPlugin<S>({
    id: "clear-urls",
    name: "Clear URLs",
    description: "Removes tracking parameters from links you send",
    defaults,
    start(s) {
        const M = findByProps("sendMessage", "receiveMessage");
        const fix = (msg: any) => { if (s.enabled && typeof msg?.content === "string") msg.content = msg.content.replace(/https?:\/\/[^\s<>)\]]+/g, cleanUrl); };
        undo.push(before("sendMessage", M, (a: any[]) => fix(a[1])));
        undo.push(before("editMessage", M, (a: any[]) => fix(a[2])));
    },
    stop() { undo.splice(0).forEach(u => u()); },
    Settings({ storage }) {
        useProxy(storage);
        return <Scroll><Section><Switch store={storage} k="enabled" label="Clean links I send" sub="utm_*, fbclid, si=, Amazon/TikTok/X junk…" /></Section></Scroll>;
    },
});
