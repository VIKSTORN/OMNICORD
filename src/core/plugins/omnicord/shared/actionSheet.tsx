import { after, before, findByProps, findInReactTree, Forms, logger, React, ReactNative as RN, semanticColors, stylesheet } from "../vd";
// Shared helper: inject rows into the message long-press action sheet.

export const LazyActionSheet = findByProps("openLazy", "hideActionSheet");
const ActionSheetRow = findByProps("ActionSheetRow")?.ActionSheetRow ?? Forms.FormRow;

const styles = stylesheet.createThemedStyleSheet({
    icon: { width: 24, height: 24, tintColor: semanticColors.INTERACTIVE_NORMAL },
});

export function makeRow(label: string, icon: number, onPress: () => void, key?: string) {
    return React.createElement(ActionSheetRow, {
        key: key ?? label,
        label,
        icon: ActionSheetRow.Icon
            ? React.createElement(ActionSheetRow.Icon, {
                source: icon,
                IconComponent: () => <RN.Image resizeMode="cover" style={styles.icon} source={icon} />,
            })
            : undefined,
        leading: !ActionSheetRow.Icon && Forms.FormRow.Icon ? <Forms.FormRow.Icon source={icon} /> : undefined,
        onPress,
    });
}

export const hideSheet = () => LazyActionSheet.hideActionSheet();

/** build(message) returns rows to prepend to the first row group (or nothing). */
export function patchMessageSheet(build: (message: any) => any[] | null | undefined) {
    return before("openLazy", LazyActionSheet, ([component, key, msg]) => {
        const message = msg?.message;
        if (key !== "MessageLongPressActionSheet" || !message) return;

        component.then((instance: any) => {
            const unpatch = after("default", instance, (_: any, tree: any) => {
                React.useEffect(() => () => void unpatch(), []);
                const rows = build(message);
                if (!rows?.length) return;

                const groups: any[] = findInReactTree(
                    tree,
                    (c: any) => Array.isArray(c) && c[0]?.type?.name === "ActionSheetRowGroup",
                );
                if (groups?.length) {
                    for (const g of groups) {
                        const children = findInReactTree(
                            g,
                            (c: any) => Array.isArray(c) && c.some((x: any) => x?.type?.name === "ActionSheetRow"),
                        );
                        if (children) return void children.unshift(...rows);
                    }
                }
                const buttons = findInReactTree(
                    tree,
                    (x: any) => Array.isArray(x) && ["ActionSheetRow", "ButtonRow"].includes(x[0]?.type?.name),
                );
                if (buttons) buttons.unshift(...rows);
            });
        }).catch((e: any) => logger.error("action sheet patch failed", e));
    });
}
