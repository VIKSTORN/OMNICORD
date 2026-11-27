// Tiny PNG encoder for smooth gradients: a few pixels stretched by the GPU (bilinear) = no banding.
const CRC = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
    return t;
})();
function crc32(b: Uint8Array) { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
const u32 = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
function chunk(type: string, data: number[] | Uint8Array) {
    const body = new Uint8Array(4 + data.length);
    for (let i = 0; i < 4; i++) body[i] = type.charCodeAt(i);
    body.set(data as any, 4);
    return [...u32(data.length), ...body, ...u32(crc32(body))];
}
const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
function b64(bytes: number[]) {
    let out = "";
    for (let i = 0; i < bytes.length; i += 3) {
        const [a, b = 0, c = 0] = [bytes[i], bytes[i + 1], bytes[i + 2]];
        const n = (a << 16) | (b << 8) | c;
        out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + (i + 1 < bytes.length ? B64[(n >> 6) & 63] : "=") + (i + 2 < bytes.length ? B64[n & 63] : "=");
    }
    return out;
}

/** RGBA pixels (w*h*4) -> data:image/png;base64 uri. Uses stored (uncompressed) deflate blocks. */
export function pngDataUri(w: number, h: number, rgba: Uint8Array) {
    const raw: number[] = [];
    for (let y = 0; y < h; y++) { raw.push(0); for (let x = 0; x < w * 4; x++) raw.push(rgba[y * w * 4 + x]); }
    const z: number[] = [0x78, 0x01];
    for (let i = 0; i < raw.length; i += 65535) {
        const block = raw.slice(i, i + 65535), last = i + 65535 >= raw.length ? 1 : 0;
        z.push(last, block.length & 255, block.length >> 8, ~block.length & 255, (~block.length >> 8) & 255, ...block);
    }
    let a = 1, b = 0;
    for (const v of raw) { a = (a + v) % 65521; b = (b + a) % 65521; }
    z.push(...u32(((b << 16) | a) >>> 0));
    const png = [137, 80, 78, 71, 13, 10, 26, 10,
        ...chunk("IHDR", [...u32(w), ...u32(h), 8, 6, 0, 0, 0]),
        ...chunk("IDAT", z), ...chunk("IEND", [])];
    return `data:image/png;base64,${b64(png)}`;
}

/** Gradient image from color stops (#rrggbb). dir: v = top→bottom, h = left→right, d = top-left→bottom-right. */
export function gradientUri(stops: [number, number, number][], dir: "v" | "h" | "d") {
    const S = dir === "d" ? 24 : 48;
    const w = dir === "v" ? 1 : S, h = dir === "h" ? 1 : S;
    const px = new Uint8Array(w * h * 4);
    const at = (t: number) => {
        const f = t * (stops.length - 1), i = Math.min(stops.length - 2, Math.floor(f)), k = f - i;
        const [a, b] = [stops[i], stops[i + 1]];
        // smoothstep between stops: softer transitions
        const s = k * k * (3 - 2 * k);
        return [0, 1, 2].map(j => Math.round(a[j] + (b[j] - a[j]) * s));
    };
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const t = dir === "v" ? y / (h - 1) : dir === "h" ? x / (w - 1) : (x + y) / (w + h - 2);
        const [r, g, bl] = at(t);
        const o = (y * w + x) * 4;
        px[o] = r; px[o + 1] = g; px[o + 2] = bl; px[o + 3] = 255;
    }
    return pngDataUri(w, h, px);
}
