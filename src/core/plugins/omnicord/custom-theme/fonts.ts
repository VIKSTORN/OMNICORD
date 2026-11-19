// One-tap fonts: Kettu font definitions (spec 1) pointing at Google Fonts files. Applied by the
// xposed font hook at app start, so a restart is needed after switching.
import { fonts, saveFont, selectFont } from "@lib/addons/fonts";
import { isFontSupported } from "@lib/api/native/loader";

const G = "https://raw.githubusercontent.com/google/fonts/main/";
// Discord's font families, by weight.
const W = { Normal: "R", Medium: "M", Semibold: "SB", Bold: "B", ExtraBold: "EB" } as const;
type Wt = typeof W[keyof typeof W];

function def(name: string, files: Partial<Record<Wt, string>> | string) {
    const f = typeof files === "string" ? { R: files } : files;
    const pick = (w: Wt) => G + encodeURI(f[w] ?? (w === "EB" ? f.B : w === "SB" ? f.B ?? f.M : w === "M" ? f.R : undefined) ?? f.B ?? f.R!);
    const main: Record<string, string> = {};
    for (const [fam, w] of Object.entries(W)) main[`ggsans-${fam}`] = main[`ggsans-${fam}Italic`] = pick(w);
    return { spec: 1 as const, name: `Omnicord ${name}`, description: `${name} (Google Fonts)`, main };
}
const st = (dir: string, base: string, ws: Wt[]) => Object.fromEntries(ws.map(w => [w, `${dir}/${base}-${{ R: "Regular", M: "Medium", SB: "SemiBold", B: "Bold", EB: "ExtraBold" }[w]}.ttf`]));

export const FONT_PRESETS = [
    def("Poppins", st("ofl/poppins", "Poppins", ["R", "M", "SB", "B", "EB"])),
    def("Fira Sans", st("ofl/firasans", "FiraSans", ["R", "M", "SB", "B", "EB"])),
    def("Barlow", st("ofl/barlow", "Barlow", ["R", "M", "SB", "B", "EB"])),
    def("Ubuntu", st("ufl/ubuntu", "Ubuntu", ["R", "M", "B"])),
    def("Inter", "ofl/inter/Inter[opsz,wght].ttf"),
    def("Nunito", "ofl/nunito/Nunito[wght].ttf"),
    def("Rubik", "ofl/rubik/Rubik[wght].ttf"),
    def("Lexend", "ofl/lexend/Lexend[wght].ttf"),
    def("Outfit", "ofl/outfit/Outfit[wght].ttf"),
    def("Manrope", "ofl/manrope/Manrope[wght].ttf"),
    def("Montserrat", "ofl/montserrat/Montserrat[wght].ttf"),
    def("DM Sans", "ofl/dmsans/DMSans[opsz,wght].ttf"),
    def("Quicksand", "ofl/quicksand/Quicksand[wght].ttf"),
    def("Comfortaa", "ofl/comfortaa/Comfortaa[wght].ttf"),
    def("Atkinson Hyperlegible", st("ofl/atkinsonhyperlegible", "AtkinsonHyperlegible", ["R", "B"])),
    def("Comic Neue", st("ofl/comicneue", "ComicNeue", ["R", "B"])),
    def("JetBrains Mono", "ofl/jetbrainsmono/JetBrainsMono[wght].ttf"),
    def("Space Mono", st("ofl/spacemono", "SpaceMono", ["R", "B"])),
    def("Silkscreen", st("ofl/silkscreen", "Silkscreen", ["R", "B"])),
    def("VT323", "ofl/vt323/VT323-Regular.ttf"),
    def("Press Start 2P", "ofl/pressstart2p/PressStart2P-Regular.ttf"),
];

export const fontsSupported = () => { try { return isFontSupported(); } catch { return false; } };
export const currentFont = (): string | null => { try { return fonts.__selected ?? null; } catch { return null; } };
export const fontLabel = (n: string | null) => n ? n.replace(/^Omnicord /, "") : "Discord default";

/** Downloads (first time) and selects a preset, or null for Discord's font. */
export async function applyFont(name: string | null) {
    if (!name) return selectFont(null);
    if (!(name in fonts)) {
        const d = FONT_PRESETS.find(f => f.name === name);
        if (!d) throw new Error("Unknown font");
        await saveFont(d as any);
    }
    await selectFont(name);
}
