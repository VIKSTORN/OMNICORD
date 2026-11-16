// Settings-UI helpers for Omnicord plugins, built on SafeUI (React Native primitives only).
import { SafeDivider, SafeInput, SafePage, SafeRow, SafeSection, SafeSwitchRow } from "@core/ui/components/SafeUI";

import { getAssetIDByName } from "../vd";

export const icon = (name: string) => getAssetIDByName(name);

export function Switch({ store, k, label, sub, iconName }: { store: any; k: string; label: string; sub?: string; iconName?: string }) {
    return <SafeSwitchRow label={label} sub={sub} icon={iconName ? icon(iconName) : undefined}
        value={!!store[k]} onValueChange={v => void (store[k] = v)} />;
}

export function Input({ store, k, title, placeholder }: { store: any; k: string; title: string; placeholder?: string }) {
    return <SafeInput title={title} placeholder={placeholder} value={store[k] ?? ""} onChange={v => void (store[k] = v)} />;
}

export const Scroll = SafePage;
export const Section = SafeSection;
export const Row = SafeRow;
export const Divider = SafeDivider;
