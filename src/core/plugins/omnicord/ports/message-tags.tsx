// Port of MessageTags: save text snippets and send them with /tag.
import { Txt } from "@core/ui/components/SafeUI";

import { Row, Scroll, Section } from "../shared/ui";
import { findByProps, omniPlugin, registerCommand, useProxy } from "../vd";

const defaults = { tags: {} as Record<string, string> };
type S = typeof defaults;
let undo: (() => void)[] = [];

const opt = (name: string, description: string, required = true) =>
    ({ name, displayName: name, description, displayDescription: description, type: 3, required });
const cmd = (name: string, description: string, options: any[], execute: (args: any[], ctx: any) => any) => registerCommand({
    name, displayName: name, description, displayDescription: description, options,
    applicationId: "-1", inputType: 1, type: 1, execute,
} as any);

export default omniPlugin<S>({
    id: "message-tags",
    name: "Message Tags",
    description: "Save snippets with /tag-save, send them with /tag, list them with /tag-list",
    defaults,
    start(s) {
        const Bot = findByProps("sendBotMessage");
        const get = (args: any[], n: string) => args.find(a => a.name === n)?.value as string | undefined;
        const say = (ctx: any, t: string) => Bot.sendBotMessage(ctx.channel.id, t);
        undo.push(cmd("tag", "Send a saved tag", [opt("name", "Tag name")], (args, ctx) => {
            const n = (get(args, "name") ?? "").toLowerCase();
            const t = s.tags[n];
            if (!t) return void say(ctx, `No tag "${n}". Saved: ${Object.keys(s.tags).join(", ") || "none"}`);
            return { content: t };
        }));
        undo.push(cmd("tag-save", "Save a tag", [opt("name", "Tag name"), opt("text", "What it sends")], (args, ctx) => {
            const n = (get(args, "name") ?? "").toLowerCase().trim();
            const t = get(args, "text") ?? "";
            if (!n || !t) return void say(ctx, "Give a name and a text");
            s.tags = { ...s.tags, [n]: t };
            say(ctx, `Saved tag "${n}"`);
        }));
        undo.push(cmd("tag-delete", "Delete a tag", [opt("name", "Tag name")], (args, ctx) => {
            const n = (get(args, "name") ?? "").toLowerCase();
            const next = { ...s.tags }; delete next[n]; s.tags = next;
            say(ctx, `Deleted tag "${n}"`);
        }));
        undo.push(cmd("tag-list", "List your tags", [], (_a, ctx) => {
            const list = Object.entries(s.tags).map(([k, v]) => `**${k}**: ${v.slice(0, 50)}`).join("\n");
            say(ctx, list || "No tags yet. Use /tag-save");
        }));
    },
    stop() { undo.splice(0).forEach(u => u()); },
    Settings({ storage }) {
        useProxy(storage);
        const tags = Object.entries(storage.tags);
        return (
            <Scroll>
                <Section title="Commands">
                    <Txt style={{ color: "#b5bac1", fontSize: 13, padding: 14 }}>/tag-save name text · /tag name · /tag-list · /tag-delete name</Txt>
                </Section>
                <Section title={`Saved (${tags.length})`}>
                    {tags.map(([k, v]) => <Row key={k} label={k} sub={v.slice(0, 80)} danger onPress={() => { const n = { ...storage.tags }; delete n[k]; storage.tags = n; }} />)}
                    {!tags.length ? <Txt style={{ color: "#949ba4", fontSize: 13, padding: 14 }}>No tags yet. Tap a tag to delete it.</Txt> : null}
                </Section>
            </Scroll>
        );
    },
});
