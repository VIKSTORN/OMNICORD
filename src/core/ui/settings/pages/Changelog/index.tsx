import { CHANGELOG } from "@core/changelog";
import { SafePage, SafeSection, Txt, useSafeColors } from "@core/ui/components/SafeUI";
import { View } from "react-native";

const KIND = /^(New|Fix|Change|Manager|Settings):\s*/;

export default function Changelog() {
    const col = useSafeColors();
    return (
        <SafePage>
            {CHANGELOG.map((e, i) => (
                <SafeSection key={e.v} title={`Release ${e.v} · ${e.date}${i === 0 ? " · latest" : ""}`}>
                    <View style={{ padding: 14, gap: 6 }}>
                        <Txt style={{ color: col.text, fontSize: 16, fontWeight: "700" }}>{e.title}</Txt>
                        {e.items.map((it, j) => {
                            const kind = KIND.exec(it)?.[1];
                            return (
                                <View key={j} style={{ flexDirection: "row", gap: 8 }}>
                                    <Txt style={{ color: col.muted, fontSize: 14 }}>•</Txt>
                                    <Txt style={{ color: col.text, fontSize: 14, flex: 1 }}>
                                        {kind ? <Txt style={{ color: kind === "Fix" ? "#f0b232" : col.muted, fontWeight: "700" }}>{kind}  </Txt> : null}
                                        {it.replace(KIND, "")}
                                    </Txt>
                                </View>
                            );
                        })}
                    </View>
                </SafeSection>
            ))}
        </SafePage>
    );
}
