// Omnicord: Vendetta-style API surface backed by Kettu internals, so built-in plugins
// read like regular community plugins.
import { showConfirmationAlert as _confirm } from "@core/vendetta/alerts";
import { useProxy } from "@core/vendetta/storage";
import { findAssetId } from "@lib/api/assets";
import { registerCommand } from "@lib/api/commands";
import { after, before, instead } from "@lib/api/patcher";
import { createStorage, createStorageAsync } from "@lib/api/storage";
import { findInReactTree } from "@lib/utils";
import { LoggerClass } from "@lib/utils/logger";
import { findByName, findByProps, findByStoreName } from "@metro";
import { clipboard, FluxDispatcher, React, ReactNative, url } from "@metro/common";
import { Forms } from "@metro/common/components";
import { semanticColors } from "@ui/color";
import { createThemedStyleSheet } from "@ui/styles";
import { showToast } from "@ui/toasts";

import { defineCorePlugin } from "..";

export {
    after, before, clipboard, findByName, findByProps, findByStoreName, findInReactTree, FluxDispatcher, Forms,
    instead, React, ReactNative, registerCommand, semanticColors, showToast, url, useProxy,
};
export const stylesheet = { createThemedStyleSheet };
export const getAssetIDByName = (name: string) => findAssetId(name) as number;
export const showConfirmationAlert = (o: any) => _confirm(o);
export const logger = new LoggerClass("Omnicord");

interface OmniPlugin<S extends object> {
    id: string;
    name: string;
    description: string;
    defaults?: S;
    preenabled?: boolean;
    start(storage: S): void | Promise<void>;
    stop?(storage: S): void;
    Settings?: (props: { storage: S }) => React.ReactElement | null;
}

/** Define an Omnicord built-in plugin with its own persistent storage (omnicord/<id>.json). */
export function omniPlugin<S extends object = Record<string, any>>(p: OmniPlugin<S>) {
    const path = `omnicord/${p.id}.json`;
    let storage: S | undefined;
    const load = async () => {
        storage ??= await createStorageAsync<S>(path, { dflt: { ...(p.defaults ?? {}) } as S });
        for (const [k, v] of Object.entries(p.defaults ?? {})) (storage as any)[k] ??= v;
        return storage;
    };
    const Settings = p.Settings;

    return {
        preenabled: p.preenabled ?? true,
        default: defineCorePlugin({
            manifest: {
                id: `omnicord.${p.id}`,
                version: "1.0.0",
                type: "plugin",
                spec: 3,
                main: "",
                display: { name: p.name, description: p.description, authors: [{ name: "Omnicord" }] },
            },
            async start() { await p.start(await load()); },
            stop() { storage && p.stop?.(storage); },
            SettingsComponent: Settings && (() => {
                const [s, set] = React.useState<S | undefined>(storage);
                React.useEffect(() => { if (!s) load().then(set); }, []);
                return s ? React.createElement(Settings, { storage: s }) : null;
            }),
        }),
    };
}

void createStorage;
