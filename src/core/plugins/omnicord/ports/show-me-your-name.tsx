// Port of ShowMeYourName + exact timestamps: "Nickname (@username)" and seconds on message times.
import { Scroll, Section, Switch } from "../shared/ui";
import { after, findByName, omniPlugin, useProxy } from "../vd";

const defaults = { username: true, seconds: false, fullDate: false };
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
            if (s.username && typeof m.username === "string" && author.username && !m.username.includes(`@${author.username}`)
                && m.username.toLowerCase() !== author.username.toLowerCase())
                m.username = `${m.username} (@${author.username})`;
            if ((s.seconds || s.fullDate) && typeof m.timestamp === "string") {
                const t = data.message.timestamp;
                const d: Date | undefined = t?.toDate?.() ?? (t ? new Date(t) : undefined);
                if (d && !isNaN(+d)) {
                    const time = `${pad(d.getHours())}:${pad(d.getMinutes())}${s.seconds ? `:${pad(d.getSeconds())}` : ""}`;
                    const date = s.fullDate ? `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ` : "";
                    // keep anything another plugin put before the time (e.g. platform icons)
                    m.timestamp = m.timestamp.replace(/[^\s]*\d{1,2}[:h]\d{2}.*$/, `${date}${time}`);
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
            </Scroll>
        );
    },
});
