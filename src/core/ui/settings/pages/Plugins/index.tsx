// Omnicord: plugins page using only React Native primitives (see SafeUI.tsx).
import { SafeButton, SafeDivider, SafeInput, SafePage, SafeSection, SafeSwitchRow, SafeText, useSafeColors } from "@core/ui/components/SafeUI";
import { UnifiedPluginModel } from "@core/ui/settings/pages/Plugins/models";
import { VdPluginManager } from "@core/vendetta/plugins";
import { useProxy } from "@core/vendetta/storage";
import { isCorePlugin, isPluginInstalled, pluginSettings, registeredPlugins } from "@lib/addons/plugins";
import { useObservable } from "@lib/api/storage";
import { BUNNY_PROXY_PREFIX, VD_PROXY_PREFIX } from "@lib/utils/constants";
import { NavigationNative } from "@metro/common";
import { useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";

import unifyBunnyPlugin from "./models/bunny";
import unifyVdPlugin from "./models/vendetta";

function PluginRow({ plugin, onChange }: { plugin: UnifiedPluginModel; onChange: () => void }) {
    const navigation = NavigationNative.useNavigation();
    const col = useSafeColors();
    const Settings = plugin.getPluginSettingsComponent();
    const enabled = plugin.isEnabled();
    const authors = plugin.authors?.map(a => (typeof a === "string" ? a : a.name)).join(", ");

    return (
        <View>
            <SafeSwitchRow
                label={plugin.name}
                sub={[plugin.description, authors && `by ${authors}`].filter(Boolean).join("\n")}
                value={enabled}
                onValueChange={v => {
                    try { plugin.toggle(v); } catch (e) { Alert.alert("Couldn't toggle plugin", String(e)); }
                    onChange();
                }}
            />
            {enabled && Settings ? (
                <Pressable onPress={() => navigation.push("PUPU_CUSTOM_PAGE", { title: plugin.name, render: Settings })}
                    style={{ paddingHorizontal: 14, paddingBottom: 12, marginTop: -6 }}>
                    <Text style={{ color: col.accent, fontWeight: "700" }}>⚙ Settings</Text>
                </Pressable>
            ) : null}
        </View>
    );
}

function List({ items, onChange }: { items: UnifiedPluginModel[]; onChange: () => void }) {
    return <>{items.map((p, i) => (
        <View key={p.id}>
            {i > 0 && <SafeDivider />}
            <PluginRow plugin={p} onChange={onChange} />
        </View>
    ))}</>;
}

function Installer({ onDone }: { onDone: () => void }) {
    const [url, setUrl] = useState("");
    const install = async () => {
        const u = url.trim();
        if (!u) return;
        const go = () => VdPluginManager.installPlugin(u)
            .then(() => { setUrl(""); onDone(); Alert.alert("Installed", u); })
            .catch((e: any) => Alert.alert("Install failed", e instanceof Error ? e.message : String(e)));
        if (u.startsWith(VD_PROXY_PREFIX) || u.startsWith(BUNNY_PROXY_PREFIX)) return go();
        Alert.alert("Unproxied plugin", "This plugin's code isn't reviewed. Only install it if you trust the source.", [
            { text: "Cancel", style: "cancel" },
            { text: "Install", onPress: go },
        ]);
    };
    return (
        <SafeSection title="Install a plugin">
            <SafeInput title="Plugin URL (Vendetta/Bunny/Kettu)" value={url} onChange={setUrl} placeholder="https://…/plugin-name/" />
            <View style={{ paddingHorizontal: 14, paddingBottom: 12 }}><SafeButton text="Install" onPress={install} /></View>
        </SafeSection>
    );
}

export default function Plugins() {
    useProxy(VdPluginManager.plugins);
    useObservable([pluginSettings]);
    const [, bump] = useState(0);
    const refresh = () => bump(n => n + 1);

    const all = [...registeredPlugins.values()].filter(p => p?.id && p.display && isPluginInstalled(p.id));
    const omni = all.filter(p => p.id.startsWith("omnicord.")).map(unifyBunnyPlugin);
    const core = all.filter(p => isCorePlugin(p.id) && !p.id.startsWith("omnicord.")).map(unifyBunnyPlugin);
    const external = [
        ...Object.values(VdPluginManager.plugins).map(unifyVdPlugin),
        ...all.filter(p => !isCorePlugin(p.id)).map(unifyBunnyPlugin),
    ];
    const byName = (a: UnifiedPluginModel, b: UnifiedPluginModel) => a.name.localeCompare(b.name);

    return (
        <SafePage>
            <SafeSection title="Omnicord plugins"><List items={omni.sort(byName)} onChange={refresh} /></SafeSection>
            {external.length ? <SafeSection title="Installed plugins"><List items={external.sort(byName)} onChange={refresh} /></SafeSection> : null}
            <SafeSection title="Built-in (Kettu)"><List items={core.sort(byName)} onChange={refresh} /></SafeSection>
            <Installer onDone={refresh} />
            <SafeText muted style={{ textAlign: "center", fontSize: 12 }}>Turn a plugin on to see its settings.</SafeText>
        </SafePage>
    );
}
