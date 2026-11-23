import type { ChangelogEntry } from "@core/changelog";
import { Txt, useSafeColors } from "@core/ui/components/SafeUI";
import { View } from "react-native";

const KIND = /^(New|Fix|Change|Manager|Settings):\s*/;
const TAG: Record<string, string> = { New: "#23a55a", Fix: "#f0b232", Change: "#5865f2", Manager: "#949ba4", Settings: "#949ba4" };

export function Tag({ kind }: { kind: string; }) {
    const c = TAG[kind] ?? "#949ba4";
    return (
        <View style={{ backgroundColor: c + "26", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1, alignSelf: "flex-start", marginTop: 2 }}>
            <Txt style={{ color: c, fontSize: 11, fontWeight: "700", letterSpacing: 0.3 }}>{kind.toUpperCase()}</Txt>
        </View>
    );
}

/** One release: title, date, tagged lines. */
export function ChangelogCard({ e, latest }: { e: ChangelogEntry; latest?: boolean; }) {
    const col = useSafeColors();
    return (
        <View style={{ backgroundColor: col.card, borderRadius: 16, padding: 16, gap: 10 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Txt style={{ color: col.text, fontSize: 17, fontWeight: "700", flex: 1 }}>{e.title}</Txt>
                {latest ? <Tag kind="Latest" /> : null}
            </View>
            <Txt style={{ color: col.muted, fontSize: 12, marginTop: -6 }}>Release {e.v} · {e.date}</Txt>
            {e.items.map((it, j) => {
                const kind = KIND.exec(it)?.[1];
                return (
                    <View key={j} style={{ flexDirection: "row", gap: 8, alignItems: "flex-start" }}>
                        {kind ? <Tag kind={kind} /> : <Txt style={{ color: col.muted, fontSize: 14 }}>•</Txt>}
                        <Txt style={{ color: col.text, fontSize: 14, lineHeight: 20, flex: 1 }}>{it.replace(KIND, "")}</Txt>
                    </View>
                );
            })}
        </View>
    );
}
