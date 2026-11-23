import PupuIcon from "@assets/icons/omnicord.png";
import { Strings } from "@core/i18n";
import { useProxy } from "@core/vendetta/storage";
import { findAssetId } from "@lib/api/assets";
import { isFontSupported, isThemeSupported } from "@lib/api/native/loader";
import { settings } from "@lib/api/settings";
import { registerSection } from "@ui/settings";
import { version } from "bunny-build-info";
import { CHANGELOG, latestVersion, showWhatsNew } from "@core/changelog";

export { PupuIcon };

export default function initSettings() {
    
    registerSection({
        name: "Omnicord",
        items: [
            {
                key: "KETTU",
                title: () => Strings.PUPU,
                icon: { uri: PupuIcon },
                render: () => import("@core/ui/settings/pages/General"),
                useTrailing: () => `(${version})`
            },
            {
                key: "OMNICORD_CHANGELOG",
                title: () => "Changelog",
                icon: findAssetId("ClockIcon") ?? findAssetId("ic_history_24px") ?? findAssetId("CircleInformationIcon-primary"),
                render: () => import("@core/ui/settings/pages/Changelog"),
                useTrailing: () => `R${latestVersion}`
            },
            {
                key: "BUNNY_PLUGINS",
                title: () => Strings.PLUGINS,
                icon: findAssetId("AppsIcon"),
                render: () => import("@core/ui/settings/pages/Plugins")
            },
            {
                key: "BUNNY_THEMES",
                title: () => Strings.THEMES,
                icon: findAssetId("PaintPaletteIcon"),
                render: () => import("@core/ui/settings/pages/Themes"),
                usePredicate: () => isThemeSupported()
            },
            {
                key: "BUNNY_FONTS",
                title: () => Strings.FONTS,
                icon: findAssetId("LettersIcon"),
                render: () => import("@core/ui/settings/pages/Fonts"),
                usePredicate: () => isFontSupported()
            },
            {
                key: "KETTU_BROWSER",
                title: () => Strings.BROWSER,
                icon: findAssetId("ChannelListMagnifyingGlassIcon"),
                render: () => import("@core/ui/settings/pages/PluginBrowser"),
            },
            {
                key: "BUNNY_DEVELOPER",
                title: () => Strings.DEVELOPER,
                icon: findAssetId("WrenchIcon"),
                render: () => import("@core/ui/settings/pages/Developer"),
                usePredicate: () => useProxy(settings).developerSettings ?? false
            }
        ]
    });

    // "What's new" once after each update.
    setTimeout(() => {
        try {
            const s = settings as any;
            const seen = Number(s.omniChangelogSeen ?? latestVersion - 1);
            if (seen >= latestVersion) return;
            s.omniChangelogSeen = latestVersion;
            const fresh = CHANGELOG.filter(e => e.v > seen).slice(0, 3);
            showWhatsNew(fresh);
        } catch { }
    }, 4000);

    // Compat with Bunny Plugins that use configs in settings
    registerSection({
        name: "Bunny",
        items: []
    });

    // Compat with Revenge Plugins that use configs in settings
    registerSection({
        name: "Revenge",
        items: []
    });

    // Compat with Vendetta Plugins that use configs in settings
    registerSection({
        name: "Vendetta",
        items: []
    });
}