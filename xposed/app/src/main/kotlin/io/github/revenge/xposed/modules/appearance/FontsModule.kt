package io.github.revenge.xposed.modules.appearance

import android.content.res.AssetManager
import android.graphics.Typeface
import android.graphics.Typeface.CustomFallbackBuilder
import android.graphics.fonts.Font
import android.graphics.fonts.FontFamily
import android.os.Build
import de.robv.android.xposed.XC_MethodHook
import de.robv.android.xposed.XC_MethodReplacement
import de.robv.android.xposed.XposedHelpers
import de.robv.android.xposed.callbacks.XC_LoadPackage
import io.github.revenge.xposed.Constants
import io.github.revenge.xposed.Module
import io.github.revenge.xposed.Utils.Companion.JSON
import io.github.revenge.xposed.Utils.Log
import io.ktor.client.*
import io.ktor.client.call.*
import io.ktor.client.engine.cio.*
import io.ktor.client.plugins.*
import io.ktor.client.request.*
import io.ktor.client.statement.*
import io.ktor.http.*
import kotlinx.coroutines.*
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonObjectBuilder
import kotlinx.serialization.json.put
import java.io.File
import java.io.IOException

@Serializable
data class FontDefinition(
    val name: String? = null,
    val description: String? = null,
    val spec: Int? = null,
    val main: Map<String, String>,
)

object FontsModule : Module() {
    private val EXTENSIONS = arrayOf("", "_bold", "_italic", "_bold_italic")
    private val FILE_EXTENSIONS = arrayOf(".ttf", ".otf")
    private const val FONTS_ASSET_PATH = "fonts/"

    private val FONT_MANAGER_CLASSES = arrayOf(
        "com.facebook.react.views.text.ReactFontManager\$Companion",
        "com.facebook.react.common.assets.ReactFontManager\$Companion",
    )

    private lateinit var fontsDir: File
    private lateinit var fontsDownloadsDir: File
    private var fontsAbsPath: String? = null

    override fun buildPayload(builder: JsonObjectBuilder) {
        builder.apply {
            put("fontPatch", 2)
        }
    }

    override fun onLoad(packageParam: XC_LoadPackage.LoadPackageParam) = with(packageParam) {
        val replacement = object : XC_MethodReplacement() {
            override fun replaceHookedMethod(param: MethodHookParam): Typeface? {
                val fontFamilyName: String = param.args[0].toString()
                val style: Int = param.args[1] as Int
                val assetManager: AssetManager = param.args[2] as AssetManager
                return createAssetTypeface(fontFamilyName, style, assetManager)
            }
        }

        // React Native moved ReactFontManager between releases, so try every known package.
        // Never let this throw: an uncaught error here aborts the whole module chain.
        val hooked = FONT_MANAGER_CLASSES.any { className ->
            runCatching {
                XposedHelpers.findAndHookMethod(
                    className,
                    classLoader,
                    "createAssetTypeface",
                    String::class.java,
                    Int::class.java,
                    "android.content.res.AssetManager",
                    replacement
                )
            }.onFailure { Log.e("Failed to hook createAssetTypeface on $className", it) }
                .isSuccess
        }

        if (!hooked) Log.e("Failed to hook createAssetTypeface on all known ReactFontManager classes")

        val fontDefFile = File(appInfo.dataDir, "${Constants.FILES_DIR}/fonts.json").apply { asFile() }
        if (!fontDefFile.exists()) return@with

        val fontDef = try {
            JSON.decodeFromString<FontDefinition>(fontDefFile.readText())
        } catch (_: Throwable) {
            return@with
        }

        fontsDownloadsDir = File(appInfo.dataDir, "${Constants.FILES_DIR}/downloads/fonts").apply { asDir() }
        fontsDir = File(fontsDownloadsDir, fontDef.name!!).apply { asDir() }
        fontsAbsPath = fontsDir.absolutePath + "/"
        hookFrameworkFonts()

        fontsDir.listFiles()?.forEach { file ->
            val fileName = file.name
            if (!fileName.startsWith(".")) {
                val fontName = fileName.split('.')[0]
                if (fontDef.main.keys.none { it == fontName }) {
                    Log.i("Deleting font file: $fileName")
                    file.delete()
                }
            }
        }

        // These files should be downloaded by the JS side, but oh well
        CoroutineScope(Dispatchers.IO).launch {
            fontDef.main.keys.map { name ->
                async {
                    val url = fontDef.main.getValue(name)
                    try {
                        Log.i("Downloading $name from $url")
                        val file =
                            File(fontsDir, "$name${FILE_EXTENSIONS.first { url.endsWith(it) }}").apply { asFile() }
                        if (file.exists()) return@async

                        val client = HttpClient(CIO) {
                            install(UserAgent) { agent = Constants.USER_AGENT }
                        }

                        val response: HttpResponse = client.get(url)
                        if (response.status == HttpStatusCode.OK) file.writeBytes(response.body())

                        return@async
                    } catch (e: Throwable) {
                        Log.e("Failed to download fonts ($name from $url)", e)
                    }
                }
            }.awaitAll()
        }
    }

    private fun createAssetTypefaceWithFallbacks(
        fontFamilyNames: Array<String>, style: Int, assetManager: AssetManager
    ): Typeface? {
        val fontFamilies: MutableList<FontFamily> = ArrayList()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            // Iterate over the list of fontFamilyNames, constructing new FontFamily objects
            // for use in the CustomFallbackBuilder below.
            for (fontFamilyName in fontFamilyNames) {
                try {
                    for (fileExtension in FILE_EXTENSIONS) {
                        val (customName, refName) = fontFamilyName.split(":")
                        val file = File(fontsDownloadsDir, "$customName/$refName.$fileExtension").apply { asFile() }
                        val font = Font.Builder(file).build()
                        val family = FontFamily.Builder(font).build()
                        fontFamilies.add(family)
                    }
                } catch (_: Throwable) {
                }

                for (fontRootPath in arrayOf(fontsAbsPath, FONTS_ASSET_PATH).filterNotNull()) {
                    for (fileExtension in FILE_EXTENSIONS) {
                        val fileName =
                            StringBuilder().append(fontRootPath).append(fontFamilyName).append(fileExtension).toString()
                        try {
                            val builder = if (fileName[0] == '/') Font.Builder(File(fileName)) else Font.Builder(
                                assetManager, fileName
                            )
                            val font = builder.build()
                            val family = FontFamily.Builder(font).build()
                            fontFamilies.add(family)
                        } catch (_: RuntimeException) {
                            // If the typeface asset does not exist, try another extension.
                            continue
                        } catch (_: IOException) {
                            // If the font asset does not exist, try another extension.
                            continue
                        }
                    }
                }
            }

            // If there's some problem constructing fonts, fall back to the default behavior.
            if (fontFamilies.isEmpty()) return createAssetTypeface(fontFamilyNames[0], style, assetManager)

            val fallbackBuilder = CustomFallbackBuilder(fontFamilies[0])
            for (i in 1 until fontFamilies.size) {
                fallbackBuilder.addCustomFallback(fontFamilies[i])
            }
            return fallbackBuilder.build()
        }
        return null
    }

    /** "fonts/ggsans-Normal_bold.ttf" -> downloaded replacement file for "ggsans-Normal", if any. */
    private fun customFile(path: String?): File? {
        if (path == null || fontsAbsPath == null) return null
        var key = path.substringAfterLast('/').substringBeforeLast('.')
        for (suffix in arrayOf("_bold_italic", "_bold", "_italic")) if (key.endsWith(suffix)) { key = key.removeSuffix(suffix); break }
        return FILE_EXTENSIONS.map { File(fontsDir, "$key$it") }.firstOrNull { it.exists() && it.length() > 0 }
    }

    /**
     * Newer Discord builds minify React Native's ReactFontManager, so the createAssetTypeface hook can
     * miss. Android's own font loaders are never renamed: swap Discord's bundled font files there.
     */
    private fun hookFrameworkFonts() {
        runCatching {
            XposedHelpers.findAndHookMethod(Typeface::class.java, "createFromAsset", AssetManager::class.java, String::class.java,
                object : XC_MethodHook() {
                    override fun beforeHookedMethod(param: MethodHookParam) {
                        val f = customFile(param.args[1] as? String) ?: return
                        runCatching { param.result = Typeface.createFromFile(f) }
                    }
                })
        }.onFailure { Log.e("Failed to hook Typeface.createFromAsset", it) }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val pending = java.util.Collections.synchronizedMap(java.util.WeakHashMap<Any, File>())
            runCatching {
                XposedHelpers.findAndHookConstructor(Typeface.Builder::class.java, AssetManager::class.java, String::class.java,
                    object : XC_MethodHook() {
                        override fun afterHookedMethod(param: MethodHookParam) {
                            customFile(param.args[1] as? String)?.let { pending[param.thisObject] = it }
                        }
                    })
                XposedHelpers.findAndHookMethod(Typeface.Builder::class.java, "build", object : XC_MethodHook() {
                    override fun beforeHookedMethod(param: MethodHookParam) {
                        val f = pending.remove(param.thisObject) ?: return
                        runCatching { param.result = Typeface.Builder(f).build() }
                    }
                })
            }.onFailure { Log.e("Failed to hook Typeface.Builder", it) }
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val pending = java.util.Collections.synchronizedMap(java.util.WeakHashMap<Any, File>())
            runCatching {
                XposedHelpers.findAndHookConstructor(Font.Builder::class.java, AssetManager::class.java, String::class.java,
                    object : XC_MethodHook() {
                        override fun afterHookedMethod(param: MethodHookParam) {
                            customFile(param.args[1] as? String)?.let { pending[param.thisObject] = it }
                        }
                    })
                XposedHelpers.findAndHookMethod(Font.Builder::class.java, "build", object : XC_MethodHook() {
                    override fun beforeHookedMethod(param: MethodHookParam) {
                        val f = pending.remove(param.thisObject) ?: return
                        runCatching { param.result = Font.Builder(f).build() }
                    }
                })
            }.onFailure { Log.e("Failed to hook Font.Builder", it) }
        }
    }

    private fun createAssetTypeface(
        fontFamilyName: String, style: Int, assetManager: AssetManager
    ): Typeface? {
        // This logic attempts to safely check if the frontend code is attempting to use
        // fallback fonts, and if it is, to use the fallback typeface creation logic.
        var fontFamilyName: String = fontFamilyName
        val fontFamilyNames = fontFamilyName.split(",".toRegex()).dropLastWhile { it.isEmpty() }.toTypedArray()
        for (i in fontFamilyNames.indices) {
            fontFamilyNames[i] = fontFamilyNames[i].trim()
        }

        // If there are multiple font family names:
        //   For newer versions of Android, construct a Typeface with fallbacks
        //   For older versions of Android, ignore all the fallbacks and just use the first font family
        if (fontFamilyNames.size > 1) {
            fontFamilyName = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                return createAssetTypefaceWithFallbacks(fontFamilyNames, style, assetManager)
            } else {
                fontFamilyNames[0]
            }
        }

        val extension = EXTENSIONS[style]

        try {
            for (fileExtension in FILE_EXTENSIONS) {
                val (customName, refName) = fontFamilyName.split(":")
                val file = File(fontsDownloadsDir, "$customName/$refName.$fileExtension").apply { asFile() }
                if (!file.exists()) throw Exception()
                return Typeface.createFromFile(file.absolutePath)
            }
        } catch (_: Throwable) {
        }

        // Lastly, after all those checks above, this is the original RN logic for
        // getting the typeface.
        for (fontRootPath in arrayOf(fontsAbsPath, FONTS_ASSET_PATH).filterNotNull()) {
            for (fileExtension in FILE_EXTENSIONS) {
                val fileName =
                    StringBuilder().append(fontRootPath).append(fontFamilyName).append(extension).append(fileExtension)
                        .toString()

                return try {
                    if (fileName[0] == '/') Typeface.createFromFile(fileName)
                    else Typeface.createFromAsset(assetManager, fileName)
                } catch (_: RuntimeException) {
                    // If the typeface asset does not exist, try another extension.
                    continue
                }
            }
        }

        return Typeface.create(fontFamilyName, style)
    }
}