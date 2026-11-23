// "What's new" sheet shown once after an update, drawn like a Discord bottom sheet.
import { getWhatsNew, showWhatsNew, subscribeWhatsNew } from "@core/changelog";
import { ChangelogCard } from "@core/ui/components/ChangelogCard";
import { Txt, useSafeColors } from "@core/ui/components/SafeUI";

import { React, ReactNative as RN } from "../vd";

export function WhatsNew() {
    const entries = React.useSyncExternalStore(subscribeWhatsNew, getWhatsNew);
    const col = useSafeColors();
    const slide = React.useRef(new RN.Animated.Value(0)).current;
    React.useEffect(() => {
        if (entries) RN.Animated.spring(slide, { toValue: 1, useNativeDriver: true, friction: 9 }).start();
    }, [entries]);
    if (!entries) return null;
    const close = () => RN.Animated.timing(slide, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => showWhatsNew(null));
    const { height } = RN.Dimensions.get("window");
    return (
        <RN.View style={[RN.StyleSheet.absoluteFill, { justifyContent: "flex-end" }]}>
            <RN.Animated.View style={[RN.StyleSheet.absoluteFill, { backgroundColor: "#000", opacity: slide.interpolate({ inputRange: [0, 1], outputRange: [0, 0.6] }) }]}>
                <RN.Pressable style={{ flex: 1 }} onPress={close} />
            </RN.Animated.View>
            <RN.Animated.View style={{
                backgroundColor: col.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: height * 0.8,
                paddingTop: 10, paddingBottom: 24, transform: [{ translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [height, 0] }) }],
            }}>
                <RN.View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: col.muted + "66", alignSelf: "center", marginBottom: 14 }} />
                <RN.View style={{ paddingHorizontal: 20, marginBottom: 12 }}>
                    <Txt style={{ color: col.text, fontSize: 22, fontWeight: "800" }}>What's new</Txt>
                    <Txt style={{ color: col.muted, fontSize: 13, marginTop: 2 }}>Omnicord updated to release {entries[0].v}</Txt>
                </RN.View>
                <RN.ScrollView contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}>
                    {entries.map((e, i) => <ChangelogCard key={e.v} e={e} latest={i === 0} />)}
                    <Txt style={{ color: col.muted, fontSize: 12, textAlign: "center", marginTop: 4 }}>Full history: Settings → Changelog</Txt>
                </RN.ScrollView>
                <RN.Pressable onPress={close} style={{ backgroundColor: "#5865f2", borderRadius: 12, marginHorizontal: 16, marginTop: 14, paddingVertical: 13, alignItems: "center" }}>
                    <Txt style={{ color: "#fff", fontSize: 15, fontWeight: "700" }}>Got it</Txt>
                </RN.Pressable>
            </RN.Animated.View>
        </RN.View>
    );
}
