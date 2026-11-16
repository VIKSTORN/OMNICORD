import { Forms, getAssetIDByName, ReactNative as RN } from "../vd";
// Tiny settings-UI helpers shared by plugins.




const { FormSwitchRow, FormInput, FormIcon, FormDivider, FormSection, FormRow } = Forms;

export const icon = (name: string) => getAssetIDByName(name);

export function Switch({ store, k, label, sub, iconName }: { store: any; k: string; label: string; sub?: string; iconName?: string }) {
    return (
        <FormSwitchRow
            label={label}
            subLabel={sub}
            leading={iconName ? <FormIcon source={icon(iconName)} /> : undefined}
            value={!!store[k]}
            onValueChange={(v: boolean) => void (store[k] = v)}
        />
    );
}

export function Input({ store, k, title, placeholder }: { store: any; k: string; title: string; placeholder?: string }) {
    return (
        <FormInput
            title={title}
            placeholder={placeholder}
            value={store[k] ?? ""}
            onChange={(v: string) => void (store[k] = v)}
        />
    );
}

export { FormDivider, FormSection, FormRow, FormIcon };
export const Scroll = ({ children }: any) => <RN.ScrollView style={{ flex: 1 }}>{children}</RN.ScrollView>;
