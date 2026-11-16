// Omnicord: settings UI built only from React Native primitives.
// Discord's design-system components get renamed/removed between versions (e.g. 349.x),
// which blanked pages; these never depend on them.
import { resolveSemanticColor, semanticColors } from "@ui/color";
import { ComponentProps, ReactNode } from "react";
import { Image, Pressable, ScrollView, Switch, Text, TextInput, View } from "react-native";

const FALLBACK = {
    bg: "#1e1f22", card: "#2b2d31", text: "#f2f3f5", muted: "#b5bac1", border: "#3f4147", accent: "#7c5cff", danger: "#da373c",
};

function c(name: string, fb: string): string {
    try {
        const v = resolveSemanticColor(semanticColors[name]);
        return typeof v === "string" ? v : fb;
    } catch { return fb; }
}

export function useSafeColors() {
    return {
        bg: c("BACKGROUND_PRIMARY", FALLBACK.bg),
        card: c("BACKGROUND_SECONDARY", FALLBACK.card),
        text: c("TEXT_NORMAL", FALLBACK.text),
        muted: c("TEXT_MUTED", FALLBACK.muted),
        border: c("BACKGROUND_MODIFIER_ACCENT", FALLBACK.border),
        accent: FALLBACK.accent,
        danger: FALLBACK.danger,
    };
}

export function SafePage({ children }: { children: ReactNode }) {
    return <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 12, paddingBottom: 48, gap: 10 }}>{children}</ScrollView>;
}

export function SafeSection({ title, children }: { title?: string; children: ReactNode }) {
    const col = useSafeColors();
    return (
        <View style={{ gap: 6 }}>
            {title ? <Text style={{ color: col.muted, fontSize: 12, fontWeight: "700", textTransform: "uppercase", marginLeft: 4 }}>{title}</Text> : null}
            <View style={{ backgroundColor: col.card, borderRadius: 12, overflow: "hidden" }}>{children}</View>
        </View>
    );
}

export function SafeRow({ label, sub, icon, trailing, onPress, danger }: {
    label: string; sub?: string; icon?: number; trailing?: ReactNode; onPress?: () => void; danger?: boolean;
}) {
    const col = useSafeColors();
    return (
        <Pressable onPress={onPress} disabled={!onPress} android_ripple={{ color: "#ffffff22" }}
            style={{ flexDirection: "row", alignItems: "center", paddingVertical: 12, paddingHorizontal: 14, gap: 12 }}>
            {icon ? <Image source={icon} style={{ width: 22, height: 22, tintColor: col.muted }} /> : null}
            <View style={{ flex: 1 }}>
                <Text style={{ color: danger ? col.danger : col.text, fontSize: 16, fontWeight: "600" }}>{label}</Text>
                {sub ? <Text style={{ color: col.muted, fontSize: 13, marginTop: 2 }}>{sub}</Text> : null}
            </View>
            {trailing}
        </Pressable>
    );
}

export function SafeSwitchRow({ value, onValueChange, ...row }: ComponentProps<typeof SafeRow> & { value: boolean; onValueChange: (v: boolean) => void; }) {
    const col = useSafeColors();
    return <SafeRow {...row} onPress={() => onValueChange(!value)}
        trailing={<Switch value={value} onValueChange={onValueChange} trackColor={{ true: col.accent, false: col.border }} thumbColor="#ffffff" />} />;
}

export function SafeInput({ title, value, onChange, placeholder }: { title: string; value: string; onChange: (v: string) => void; placeholder?: string; }) {
    const col = useSafeColors();
    return (
        <View style={{ paddingVertical: 10, paddingHorizontal: 14, gap: 6 }}>
            <Text style={{ color: col.muted, fontSize: 13, fontWeight: "600" }}>{title}</Text>
            <TextInput value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={col.muted}
                autoCapitalize="none" autoCorrect={false}
                style={{ color: col.text, backgroundColor: col.bg, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 15 }} />
        </View>
    );
}

export function SafeButton({ text, onPress, variant = "primary" }: { text: string; onPress: () => void; variant?: "primary" | "secondary"; }) {
    const col = useSafeColors();
    return (
        <Pressable onPress={onPress} style={{ backgroundColor: variant === "primary" ? col.accent : col.border, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 14, alignItems: "center" }}>
            <Text style={{ color: "#ffffff", fontWeight: "700" }}>{text}</Text>
        </Pressable>
    );
}

export function SafeDivider() {
    const col = useSafeColors();
    return <View style={{ height: 1, backgroundColor: col.border, marginLeft: 14 }} />;
}

export function SafeText({ children, muted, style }: { children: ReactNode; muted?: boolean; style?: any }) {
    const col = useSafeColors();
    return <Text style={[{ color: muted ? col.muted : col.text, fontSize: 14 }, style]}>{children}</Text>;
}
