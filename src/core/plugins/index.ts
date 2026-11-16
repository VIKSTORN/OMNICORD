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
