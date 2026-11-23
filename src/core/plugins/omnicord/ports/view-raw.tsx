// Port of ViewRaw / CopyMessage: long-press → copy the raw markdown of a message.
import { makeRow, patchMessageSheet } from "../shared/actionSheet";
import { icon } from "../shared/ui";
import { clipboard, omniPlugin, showToast } from "../vd";

let undo: (() => void) | undefined;

export default omniPlugin({
    id: "view-raw",
    name: "Copy Raw",
    description: "Long-press a message → Copy raw text (markdown, emoji codes, mentions as IDs)",
    start() {
        undo = patchMessageSheet(message => {
            if (!message?.content) return;
            return [makeRow("Copy raw text", icon("ic_copy_message_link") ?? icon("CopyIcon"), () => {
                clipboard.setString(message.content);
                showToast("Raw text copied", icon("check"));
            }, "omni-copy-raw")];
        });
    },
    stop() { undo?.(); },
});
