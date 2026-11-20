// Custom RPC: show any "Playing / Listening / Watching / Competing / Streaming" activity on your profile.
import { Txt } from "@core/ui/components/SafeUI";

import { addQuickActions } from "../shared/quick";
import { Input, Row, Scroll, Section, Switch } from "../shared/ui";
import { findByProps, FluxDispatcher, logger, omniPlugin, React, ReactNative as RN, showToast, useProxy } from "../vd";

const TYPES: [number, string][] = [[0, "Playing"], [2, "Listening to"], [3, "Watching"], [5, "Competing in"], [1, "Streaming"]];

const defaults = {
    enabled: false,
    appId: "",          // Discord application id: needed for pictures and buttons
    type: 0,
    name: "Omnicord",
    details: "",
    state: "",
    streamUrl: "",      // Streaming only: twitch / youtube url
    largeImage: "",     // https link (needs app id) or the app's asset name
    largeText: "",
    smallImage: "",
    smallText: "",
    button1: "", button1Url: "",
    button2: "", button2Url: "",
    timer: "start" as "none" | "start" | "custom",
    timerMinutes: "0",  // custom: already elapsed
    partyCur: "", partyMax: "",
};
type S = typeof defaults;

const SOCKET = "OmnicordRPC";
let startedAt = Date.now();
let unsub: (() => void) | undefined;
let unquick: (() => void) | undefined;
let timer: any;
const assetCache = new Map<string, string>();

const HTTP = () => findByProps("getAPIBaseURL", "post") ?? findByProps("getAPIBaseURL");

/** https picture -> "mp:external/…" via Discord's external-assets endpoint (what Vencord does). */
async function resolveImage(appId: string, img: string): Promise<string | undefined> {
    img = img.trim();
    if (!img) return;
    if (!/^https?:\/\//i.test(img)) return img;          // an asset key of the application
    if (!appId) return;
    const key = `${appId}|${img}`;
    if (assetCache.has(key)) return assetCache.get(key);
    try {
        const res = await HTTP().post({ url: `/applications/${appId}/external-assets`, body: { urls: [img] } });
        const path = res?.body?.[0]?.external_asset_path;
        if (path) { assetCache.set(key, `mp:${path}`); return `mp:${path}`; }
    } catch (e) { logger.error("rpc image", e); }
}

function dispatch(activity: any) {
    FluxDispatcher.dispatch({ type: "LOCAL_ACTIVITY_UPDATE", activity, pid: 2312, socketId: SOCKET } as any);
}

async function build(s: S) {
    const appId = s.appId.trim();
    const a: any = { name: s.name.trim() || "Omnicord", type: +s.type || 0, flags: 1 };
    if (appId) a.application_id = appId;
    if (s.details.trim()) a.details = s.details.trim();
    if (s.state.trim()) a.state = s.state.trim();
    if (a.type === 1 && /^https?:/i.test(s.streamUrl)) a.url = s.streamUrl.trim();
    if (s.timer === "start") a.timestamps = { start: startedAt };
    else if (s.timer === "custom") a.timestamps = { start: Date.now() - (+s.timerMinutes || 0) * 60_000 };
    const [large, small] = await Promise.all([resolveImage(appId, s.largeImage), resolveImage(appId, s.smallImage)]);
    if (large || small) {
        a.assets = {};
        if (large) { a.assets.large_image = large; if (s.largeText.trim()) a.assets.large_text = s.largeText.trim(); }
        if (small) { a.assets.small_image = small; if (s.smallText.trim()) a.assets.small_text = s.smallText.trim(); }
    }
    const buttons = [[s.button1, s.button1Url], [s.button2, s.button2Url]].filter(([l, u]) => l.trim() && /^https?:/i.test(u.trim()));
    if (buttons.length && appId) {
        a.buttons = buttons.map(([l]) => l.trim().slice(0, 32));
        a.metadata = { button_urls: buttons.map(([, u]) => u.trim()) };
    }
    if (+s.partyMax > 0) a.party = { size: [Math.max(0, +s.partyCur || 0), +s.partyMax] };
    return a;
}

async function push(s: S) {
    if (!s.enabled) return dispatch(null);
    try { dispatch(await build(s)); } catch (e) { logger.error("rpc", e); }
}
const later = (s: S) => { clearTimeout(timer); timer = setTimeout(() => push(s), 800); };

function Choice({ s }: { s: S; }) {
    return (
        <RN.View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, padding: 12 }}>
            {TYPES.map(([t, l]) => (
                <RN.Pressable key={t} onPress={() => { s.type = t; later(s); }}
                    style={{ backgroundColor: +s.type === t ? "#5865f2" : "#4e505888", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 }}>
                    <Txt style={{ color: "#fff", fontSize: 14 }}>{l}</Txt>
                </RN.Pressable>
            ))}
        </RN.View>
    );
}

export default omniPlugin<S>({
    id: "custom-rpc",
    name: "Custom RPC",
    description: "Show any Playing / Listening / Watching / Streaming status with pictures, buttons and a timer",
    defaults,
    start(s) {
        startedAt = Date.now();
        push(s);
        // Presence resets on reconnect: send it again.
        const onConn = () => setTimeout(() => push(s), 1500);
        FluxDispatcher.subscribe("CONNECTION_OPEN", onConn);
        unsub = () => FluxDispatcher.unsubscribe("CONNECTION_OPEN", onConn);
        unquick = addQuickActions({
            id: "custom-rpc", order: 65, keepOpen: true,
            icon: ["GameControllerIcon", "ic_game_controller", "ActivitiesIcon", "ic_activity_24px"],
            label: "Custom status (RPC)", sub: () => s.enabled ? `${TYPES.find(([t]) => t === +s.type)?.[1]} ${s.name}` : "Off",
            toggled: () => s.enabled,
            run: () => { s.enabled = !s.enabled; startedAt = Date.now(); push(s); },
        });
    },
    stop() {
        clearTimeout(timer);
        unsub?.(); unquick?.();
        dispatch(null);
    },
    Settings({ storage: s }) {
        useProxy(s);
        React.useEffect(() => { later(s); }, [JSON.stringify(s)]);
        return (
            <Scroll>
                <Section>
                    <Switch store={s} k="enabled" label="Show my custom status" sub="Changes apply a second after you stop typing" />
                </Section>
                <Section title="Type">
                    <Choice s={s} />
                    {+s.type === 1 ? <Input store={s} k="streamUrl" title="Stream link (Twitch / YouTube)" placeholder="https://twitch.tv/…" /> : null}
                </Section>
                <Section title="Text">
                    <Input store={s} k="name" title="Name (the game / app)" placeholder="Omnicord" />
                    <Input store={s} k="details" title="Line 1" placeholder="Making themes" />
                    <Input store={s} k="state" title="Line 2" placeholder="On Android" />
                    <Input store={s} k="partyCur" title="Party: current (optional)" placeholder="1" />
                    <Input store={s} k="partyMax" title="Party: max (optional)" placeholder="4" />
                </Section>
                <Section title="Pictures and buttons">
                    <Input store={s} k="appId" title="Application ID (needed for pictures and buttons)" placeholder="123456789012345678" />
                    <Txt style={{ color: "#949ba4", fontSize: 12, paddingHorizontal: 14, paddingBottom: 8 }}>
                        Make one free at discord.com/developers/applications → New Application, then copy its Application ID. Its name doesn't matter.
                    </Txt>
                    <Input store={s} k="largeImage" title="Big picture (https link)" placeholder="https://i.imgur.com/….png" />
                    <Input store={s} k="largeText" title="Big picture hover text" />
                    <Input store={s} k="smallImage" title="Small picture (https link)" placeholder="https://…" />
                    <Input store={s} k="smallText" title="Small picture hover text" />
                    <Input store={s} k="button1" title="Button 1 text" placeholder="My server" />
                    <Input store={s} k="button1Url" title="Button 1 link" placeholder="https://discord.gg/…" />
                    <Input store={s} k="button2" title="Button 2 text" />
                    <Input store={s} k="button2Url" title="Button 2 link" placeholder="https://…" />
                </Section>
                <Section title="Timer">
                    {([["none", "No timer"], ["start", "Time since Discord opened"], ["custom", "Custom elapsed time"]] as const).map(([k, l]) => (
                        <Row key={k} label={l} trailing={s.timer === k ? <Txt style={{ color: "#fff" }}>✓</Txt> : undefined} onPress={() => { s.timer = k; }} />
                    ))}
                    {s.timer === "custom" ? <Input store={s} k="timerMinutes" title="Already elapsed (minutes)" placeholder="90" /> : null}
                </Section>
                <Section>
                    <Row label="Send again now" sub="Re-sends your status if it disappeared" onPress={() => { push(s); showToast("Status sent"); }} />
                </Section>
            </Scroll>
        );
    },
});
