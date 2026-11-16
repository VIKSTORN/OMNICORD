// Inject rows into the message long-press sheet.
// Discord 349 changed the sheet internals, so this uses two hooks (openLazy + JSX name match)
// and clones whatever row component the sheet already uses; falls back to RN-primitive rows.
import { SafeRow, SafeSection } from "@core/ui/components/SafeUI";

import { after, before, findByProps, findInReactTree, logger, React, ReactNative as RN } from "../vd";
import { onJsx } from "./jsx";

export interface RowSpec { __omni: true; label: string; icon?: number; onPress: () => void; key: string; }

export function makeRow(label: string, icon: number | undefined, onPress: () => void, key?: string): RowSpec {
    return { __omni: true, label, icon, onPress, key: "omni-" + (key ?? label) };
}

export const hideSheet = () => {
    for (const m of [findByProps("openLazy", "hideActionSheet"), findByProps("hideActionSheet")]) {
        try { if (m?.hideActionSheet) return void m.hideActionSheet(); } catch { }
    }
};

const isEl = (x: any) => x && typeof x === "object" && "props" in x && "type" in x;
const isRow = (x: any) => isEl(x) && typeof x.props?.onPress === "function" && (typeof x.props.label === "string" || isEl(x.props.label)) && !String(x.key ?? "").startsWith("omni-");

const ImgIcon = (src?: number) => function OmniIcon(p: any) {
    return src ? <RN.Image source={src} style={[{ width: 24, height: 24, tintColor: "#b5bac1" }, p?.style]} /> : null;
};

function cloneRow(tpl: any, spec: RowSpec) {
    const ti = tpl.props.icon;
    let icon: any;
    if (isEl(ti) && "source" in (ti.props ?? {})) icon = React.cloneElement(ti, { source: spec.icon, IconComponent: ImgIcon(spec.icon) });
    else if (typeof ti === "function" || (ti && typeof ti === "object" && !isEl(ti))) icon = ImgIcon(spec.icon);
    else icon = React.createElement(ImgIcon(spec.icon));
    const props: any = { key: spec.key, label: spec.label, onPress: spec.onPress, icon };
    for (const k of ["start", "end"]) if (k in tpl.props) props[k] = tpl.props[k];
    return React.createElement(tpl.type, props);
}

function inject(tree: any, specs: RowSpec[], fallback = true) {
    if (!tree || !specs.length) return;
    if (findInReactTree(tree, (x: any) => isEl(x) && String(x.key ?? "").startsWith("omni-"))) return; // already done

    const rows: any[] | undefined = findInReactTree(tree, (x: any) => Array.isArray(x) && x.some(isRow));
    if (rows) {
        const tpl = rows.find(isRow);
        try { return void rows.unshift(...specs.map(s => cloneRow(tpl, s))); } catch (e) { logger.error("row clone failed", e); }
    }
    if (!fallback) return;
    // Fallback: our own group, placed before the first group-looking element.
    const group = (
        <RN.View key="omni-group" style={{ marginBottom: 12 }}>
            <SafeSection>{specs.map(s => <SafeRow key={s.key} label={s.label} icon={s.icon} onPress={s.onPress} />)}</SafeSection>
        </RN.View>
    );
    const arr: any[] | undefined = findInReactTree(tree, (x: any) => Array.isArray(x) && x.filter(isEl).length >= 2);
    if (arr) arr.splice(Math.min(1, arr.length), 0, group);
    else logger.warn("action sheet: no place to inject");
}

let jsxMatched = false;
const SHEET_KEY = /Message.*(LongPress|Action)|LongPress.*Message/i;

/** build(message) returns rows (makeRow) to add to the message long-press sheet. */
export function patchMessageSheet(build: (message: any) => RowSpec[] | null | undefined) {
    const unpatches: (() => void)[] = [];

    // 1) openLazy(component, key, props)
    const Lazy = findByProps("openLazy", "hideActionSheet");
    if (Lazy) unpatches.push(before("openLazy", Lazy, ([component, key, msg]: any[]) => {
        const message = msg?.message;
        if (!message || typeof key !== "string" || !SHEET_KEY.test(key) || !component?.then) return;
        component.then((instance: any) => {
            const target = typeof instance?.default === "function" ? "default" : Object.keys(instance ?? {}).find(k => typeof instance[k] === "function");
            if (!target) return;
            const un = after(target, instance, (_: any, tree: any) => {
                React.useEffect(() => () => void un(), []);
                inject(tree, build(message) ?? [], !jsxMatched);
            });
        }).catch((e: any) => logger.error("action sheet (lazy) failed", e));
    }));

    // 2) any component named like MessageLongPressActionSheet: wrap its render output.
    const wrapped = new WeakMap<Function, Function>();
    unpatches.push(onJsx(/^MessageLongPressActionSheet|^MessageActionSheet|LongPressActionSheet$/, (C, props, ret) => {
        const message = props?.message;
        if (!message || typeof C !== "function" || C.prototype?.isReactComponent) return;
        jsxMatched = true;
        let W = wrapped.get(C);
        if (!W) {
            W = function OmniSheet(p: any) {
                const tree = C(p);
                inject(tree, build(p.message) ?? []);
                return tree;
            };
            wrapped.set(C, W);
        }
        return { ...ret, type: W };
    }));

    return () => unpatches.forEach(u => u());
}
