// Prints the newest src/core/changelog.ts entry as markdown (used for the GitHub release body).
import { readFileSync } from "fs";
const src = readFileSync(new URL("../src/core/changelog.ts", import.meta.url), "utf8");
const body = src.slice(src.indexOf("= [") + 2, src.lastIndexOf("];") + 1).replace(/^\s*\/\/.*$/gm, "");
const list = new Function(`return ${body}`)();
const e = list[0];
console.log(`**${e.title}**\n\n${e.items.map(i => `- ${i}`).join("\n")}\n`);
