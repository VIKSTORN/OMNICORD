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

    // Omnicord built-ins
    "omnicord.translator": require("./omnicord/translator"),
    "omnicord.message-logger": require("./omnicord/message-logger"),
    "omnicord.custom-theme": require("./omnicord/custom-theme"),
    "omnicord.platform-indicator": require("./omnicord/platform-indicator"),
    "omnicord.read-all": require("./omnicord/read-all"),
    "omnicord.voice-send": require("./omnicord/voice-send"),
    "omnicord.voice-save": require("./omnicord/voice-save"),
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
