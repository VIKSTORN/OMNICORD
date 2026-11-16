# Omnicord

Equicord-style Discord client for Android. Fork of [Kettu](https://github.com/C0C0B01/Kettu) (Bunny/Vendetta lineage) with built-in plugins and its own installer.

> ⚠️ Client mods break Discord's Terms of Service. Use at your own risk.

## Built-in plugins
Settings › Omnicord › Plugins (all on by default, each has its own settings page).

| Plugin | What it does |
|---|---|
| Translator | Long-press › Translate / Show original, `/translate`, optional auto-translate of what you send |
| Message Logger | Deleted messages stay (red), edits keep old versions under the message (until restart) |
| Custom Theme | Your own colors or presets (AMOLED, Midnight Blue, Forest, Rose), applied live |
| Platform Indicator | 🖥️📱🌐🎮 + status dot next to message timestamps |
| Read All Messages | `/readall` or button in its settings, DMs optional |
| Send Audio as Voice Note | Send any audio file as a voice message (real duration for .ogg/.opus) |
| Save Voice Notes | Long-press a voice message › Save / Copy link |

Source: `src/core/plugins/omnicord/`.

## Install (Android)
1. Download **OmnicordManager.apk** from [latest release](https://github.com/VIKSTORN/OMNICORD/releases/latest) and install it.
2. Open it › Install. It downloads Discord, patches it with the Omnicord module (LSPatch), installs it as a separate app (`omnicord.app`).
3. Log in. Bundle updates come automatically from the latest release.

## Repo layout
| Path | What | Upstream |
|---|---|---|
| `/` (src, scripts) | JS bundle (`omnicord.min.js`) | Kettu, BSD-3-Clause |
| `xposed/` | Loader module, fetches the bundle | KettuXposed, OSL-3.0 |
| `manager/` | Installer app | KettuManager, OSL-3.0 |

## Build
```
bun install && node scripts/build.mjs --build-minify   # dist/omnicord(.min).js
cd xposed && ./gradlew assembleRelease
cd manager && ./gradlew assembleRelease
```
CI (`.github/workflows/release.yml`) builds all three on every push to `main` and publishes a release tagged with the build number.

### Stable signing (recommended)
Without these, APKs are signed with a throwaway debug key, so a manager update needs uninstall + reinstall. Add repo secrets:
`OMNICORD_KEYSTORE_B64` (base64 .jks), `OMNICORD_KEYSTORE_PASSWORD`, `OMNICORD_KEY_ALIAS`, `OMNICORD_KEY_PASSWORD`.

## Credits
Kettu (cocobo1), Bunny (pylixonly), Vendetta team, Vencord/Equicord for plugin ideas, redstonekasi (message logger approach), dziurwa14 (voice message approach).
