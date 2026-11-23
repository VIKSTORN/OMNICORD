import { PluginInstanceInternal } from "@lib/addons/plugins/types";

interface CorePlugin {
  default: PluginInstanceInternal;
  preenabled: boolean;
}

// Called from @lib/plugins
export const getCorePlugins = (): Record<string, CorePlugin> => ({
    "bunny.quickinstall": require("./quickinstall"),
    "bunny.badges": require("./badges"),
    "bunny.notrack": require("./notrack"),
    "bunny.messagefix": require("./messagefix"),

    // Omnicord built-ins (omniPlugin() already returns { default, preenabled })
    "omnicord.translator": require("./omnicord/translator").default,
    "omnicord.message-logger": require("./omnicord/message-logger").default,
    "omnicord.custom-theme": require("./omnicord/custom-theme").default,
    "omnicord.platform-indicator": require("./omnicord/platform-indicator").default,
    "omnicord.read-all": require("./omnicord/read-all").default,
    "omnicord.voice-send": require("./omnicord/voice-send").default,
    "omnicord.voice-save": require("./omnicord/voice-save").default,
    "omnicord.fake-nitro": require("./omnicord/fake-nitro").default,
    "omnicord.custom-rpc": require("./omnicord/custom-rpc").default,
    "omnicord.silent-typing": require("./omnicord/ports/silent-typing").default,
    "omnicord.no-reply-mention": require("./omnicord/ports/no-reply-mention").default,
    "omnicord.clear-urls": require("./omnicord/ports/clear-urls").default,
    "omnicord.anonymise-files": require("./omnicord/ports/anonymise-files").default,
    "omnicord.view-raw": require("./omnicord/ports/view-raw").default,
    "omnicord.show-me-your-name": require("./omnicord/ports/show-me-your-name").default,
    "omnicord.hide-blocked": require("./omnicord/ports/hide-blocked").default,
    "omnicord.fake-deafen": require("./omnicord/ports/fake-deafen").default,
    "omnicord.relationship-notifier": require("./omnicord/ports/relationship-notifier").default,
    "omnicord.ghost-ping": require("./omnicord/ports/ghost-ping").default,
    "omnicord.keyword-notify": require("./omnicord/ports/keyword-notify").default,
    "omnicord.message-tags": require("./omnicord/ports/message-tags").default,
    "omnicord.quick-menu": require("./omnicord/quick-menu").default,
});

/**
 * @internal
 */
export function defineCorePlugin(
  instance: PluginInstanceInternal,
): PluginInstanceInternal {
  // @ts-expect-error
  instance[Symbol.for("bunny.core.plugin")] = true;
  return instance;
}
