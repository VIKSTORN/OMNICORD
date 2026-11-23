// Port of AnonymiseFileNames: uploads get a random name (keeps the extension).
import { Input, Scroll, Section, Switch } from "../shared/ui";
import { before, findByProps, omniPlugin, useProxy } from "../vd";

const defaults = { enabled: true, length: "8", consistent: "" };
type S = typeof defaults;
let undo: (() => void) | undefined;

const rand = (n: number) => Array.from({ length: n }, () => "abcdefghijklmnopqrstuvwxyz0123456789"[Math.floor(Math.random() * 36)]).join("");

function rename(s: S, name: unknown) {
    if (typeof name !== "string" || !name) return name;
    const dot = name.lastIndexOf(".");
    const ext = dot > 0 ? name.slice(dot) : "";
    const base = s.consistent.trim() || rand(Math.max(3, Math.min(32, +s.length || 8)));
    return (name.startsWith("SPOILER_") ? "SPOILER_" : "") + base + ext;
}

export default omniPlugin<S>({
    id: "anonymise-files",
    name: "Anonymise File Names",
    description: "Uploaded files get a random name instead of yours",
    defaults,
    preenabled: false,
    start(s) {
        const U = findByProps("uploadLocalFiles");
        undo = before("uploadLocalFiles", U, (args: any[]) => {
            if (!s.enabled) return;
            for (const it of args[0]?.items ?? []) {
                if (it?.filename) it.filename = rename(s, it.filename);
                else if (it?.item?.filename) it.item.filename = rename(s, it.item.filename);
            }
        });
    },
    stop() { undo?.(); },
    Settings({ storage }) {
        useProxy(storage);
        return (
            <Scroll>
                <Section>
                    <Switch store={storage} k="enabled" label="Random file names" />
                    <Input store={storage} k="length" title="Random name length" placeholder="8" />
                    <Input store={storage} k="consistent" title="Or always use this name (empty = random)" placeholder="image" />
                </Section>
            </Scroll>
        );
    },
});
