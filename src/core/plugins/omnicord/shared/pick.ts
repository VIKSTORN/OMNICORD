// File picking via whatever picker this Discord build ships (document picker or image library).
import { findByProps, showToast } from "../vd";

export interface Picked { uri: string; name?: string; type?: string; size?: number; }

export async function pickFile(mime: "image" | "audio"): Promise<Picked | undefined> {
    const DP = findByProps("pickSingle") ?? findByProps("pick", "types");
    const type = [`${mime}/*`];
    const norm = (r: any): Picked | undefined => r && { uri: r.fileCopyUri ?? r.uri, name: r.name ?? r.fileName, type: r.type, size: r.size ?? r.fileSize };
    if (DP?.pickSingle) return norm(await DP.pickSingle({ type, copyTo: "documentDirectory" }));
    if (DP?.pick) return norm((await DP.pick({ type, copyTo: "documentDirectory" }))?.[0]);
    if (mime === "image") {
        const IP = findByProps("launchImageLibrary");
        if (IP) return norm((await IP.launchImageLibrary({ mediaType: "photo", selectionLimit: 1 }))?.assets?.[0]);
    }
    showToast(mime === "audio" ? "No file picker here: use + → Files in the chat bar instead" : "No gallery picker in this Discord version: paste an image URL instead");
}
