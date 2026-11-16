// Generic JSX-creation hook: match components by name (regex), so we survive Discord renaming/moving modules.
import { after, findByProps, logger } from "../vd";

type Cb = (Component: any, props: any, ret: any) => any;
const hooks = new Set<{ test: RegExp; cb: Cb; }>();
const seen = new Set<string>();
let unpatch: (() => void)[] | null = null;

export const nameOf = (C: any): string | undefined =>
    typeof C === "function" ? (C.displayName || C.name) : C && typeof C === "object" ? (C.displayName || C.type?.displayName || C.type?.name || C.render?.name) : undefined;

/** Component names seen that match /ChatInput|ActionSheet/ — shown in settings for debugging. */
export const seenNames = () => [...seen];

function ensure() {
    if (unpatch) return;
    const rt = findByProps("jsx", "jsxs");
    const cb = ([C, props]: any[], ret: any) => {
        if (!hooks.size) return;
        const n = nameOf(C);
        if (!n) return;
        if (seen.size < 300 && /ChatInput|ActionSheet|LongPress/.test(n)) seen.add(n);
        for (const h of hooks) {
            if (!h.test.test(n)) continue;
            try {
                const r = h.cb(C, props, ret);
                if (r !== undefined) ret = r;
            } catch (e) { logger.error("jsx hook failed", n, e); }
        }
        return ret;
    };
    unpatch = [after("jsx", rt, cb), after("jsxs", rt, cb)];
}

export function onJsx(test: RegExp, cb: Cb) {
    ensure();
    const h = { test, cb };
    hooks.add(h);
    return () => void hooks.delete(h);
}
