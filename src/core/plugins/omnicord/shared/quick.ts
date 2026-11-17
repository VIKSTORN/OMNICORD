// Registry of quick actions shown in the floating Ω menu. Plugins add actions on start, remove on stop.
export interface QuickAction {
    id: string;
    label: string | (() => string);
    sub?: string | (() => string | undefined);
    order?: number;
    /** Discord asset names, first one found is used (monochrome, tinted). */
    icon?: string[];
    /** Renders a switch on the right showing this state. */
    toggled?: () => boolean;
    /** Either run() or a submenu of choices. */
    run?: () => void | Promise<void>;
    choices?: () => { label: string; selected?: boolean; run: () => void | Promise<void>; }[];
    /** Keep the menu open after running (for toggles). */
    keepOpen?: boolean;
}

const actions = new Map<string, QuickAction>();
const listeners = new Set<() => void>();
let version = 0;

export const emitQuick = () => { version++; listeners.forEach(l => l()); };
export const subscribeQuick = (l: () => void) => (listeners.add(l), () => void listeners.delete(l));
export const quickVersion = () => version;
export const getQuickActions = () => [...actions.values()].sort((a, b) => (a.order ?? 50) - (b.order ?? 50));

export function addQuickActions(...list: QuickAction[]) {
    list.forEach(a => actions.set(a.id, a));
    emitQuick();
    return () => { list.forEach(a => actions.delete(a.id)); emitQuick(); };
}

export const str = (v: string | (() => string | undefined) | undefined) => typeof v === "function" ? v() : v;

// Menu open state (opened by the Ω bubble or by other buttons, e.g. the 🌐 chat-bar button).
let menu: { ids?: string[]; title?: string; } | null = null;
export const getMenuState = () => menu;
export const openQuickMenu = (ids?: string[], title?: string) => { menu = { ids, title }; emitQuick(); };
export const closeQuickMenu = () => { menu = null; emitQuick(); };
