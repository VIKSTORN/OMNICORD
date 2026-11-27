// Port of ShowMeYourName + exact timestamps: "Nickname (@username)" and seconds on message times.
import { Txt } from "@core/ui/components/SafeUI";

import { Row, Scroll, Section, Switch } from "../shared/ui";
import { after, findByName, omniPlugin, useProxy } from "../vd";

const defaults = { username: true, seconds: false, fullDate: false, clock: "auto" as "auto" | "24h" | "12h", dateFmt: "dmy" as "dmy" | "mdy" | "ymd" };
type S = typeof defaults;
let undo: (() => void) | undefined;

const pad = (n: number) => String(n).padStart(2, "0");

export default omniPlugin<S>({
    id: "show-me-your-name",
    name: "Show Me Your Name",
    description: "Shows @username next to nicknames, optional exact message times",
    defaults,
    start(s) {
        const RowManager = findByName("RowManager");
        undo = after("generate", RowManager.prototype, ([data]: any[], row: any) => {
            if (data?.rowType !== 1) return;
            const m = row?.message, author = data.message?.author;
            if (!m || !author) return;
            if (s.username && !m.__omniNoName && typeof m.username === "string" && m.username.replace(/\u200b/g, "").trim() && author.username && !m.username.includes(`@${author.username}`)
                && m.username.toLowerCase() !== author.username.toLowerCase())
                m.username = `${m.username} (@${author.username})`;
            if ((s.seconds || s.fullDate || (s.clock ?? "auto") !== "auto") && typeof m.timestamp === "string") {
                const t = data.message.timestamp;
                const d: Date | undefined = t?.toDate?.() ?? (t ? new Date(t) : undefined);
                if (d && !isNaN(+d)) {
                    const h12 = s.clock === "12h";
                    const hh = h12 ? ((d.getHours() + 11) % 12) + 1 : pad(d.getHours());
                    const time = `${hh}:${pad(d.getMinutes())}${s.seconds ? `:${pad(d.getSeconds())}` : ""}${h12 ? (d.getHours() < 12 ? " AM" : " PM") : ""}`;
                    const D = pad(d.getDate()), M = pad(d.getMonth() + 1), Y = d.getFullYear();
                    const date = s.fullDate ? `${s.dateFmt === "mdy" ? `${M}/${D}/${Y}` : s.dateFmt === "ymd" ? `${Y}-${M}-${D}` : `${D}/${M}/${Y}`} ` : "";
                    // keep anything another plugin put before the time (e.g. platform icons)
                    m.timestamp = m.timestamp.replace(/[^\s]*\d{1,2}[:h]\d{2}(:\d{2})?(\s?[AaPp]\.?[Mm]\.?)?\s*$/, `${date}${time}`);
                }
            }
        });
    },
    stop() { undo?.(); },
    Settings({ storage }) {
        useProxy(storage);
        return (
            <Scroll>
                <Section>
                    <Switch store={storage} k="username" label="Show @username next to nicknames" />
                    <Switch store={storage} k="seconds" label="Show seconds on message times" />
                    <Switch store={storage} k="fullDate" label="Show full date on message times" />
                </Section>
                <Section title="Clock">
                    {([["auto", "Like Discord"], ["24h", "24 hours (17:31)"], ["12h", "12 hours (5:31 PM)"]] as const).map(([k, l]) =>
                        <Row key={k} label={l} trailing={(storage.clock ?? "auto") === k ? <Txt style={{ color: "#fff" }}>✓</Txt> : undefined} onPress={() => void (storage.clock = k)} />)}
                </Section>
                <Section title="Date format">
                    {([["dmy", "27/11/2026"], ["mdy", "11/27/2026"], ["ymd", "2026-11-27"]] as const).map(([k, l]) =>
                        <Row key={k} label={l} trailing={(storage.dateFmt ?? "dmy") === k ? <Txt style={{ color: "#fff" }}>✓</Txt> : undefined} onPress={() => void (storage.dateFmt = k)} />)}
                </Section>
            </Scroll>
        );
    },
});
