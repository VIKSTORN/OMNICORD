package dev.beefers.vendetta.manager.installer.step.patching

import android.content.Context
import androidx.compose.ui.graphics.Color
import com.github.diamondminer88.zip.ZipReader
import com.github.diamondminer88.zip.ZipWriter
import dev.beefers.vendetta.manager.R
import dev.beefers.vendetta.manager.domain.manager.PreferenceManager
import dev.beefers.vendetta.manager.installer.step.Step
import dev.beefers.vendetta.manager.installer.step.StepGroup
import dev.beefers.vendetta.manager.installer.step.StepRunner
import dev.beefers.vendetta.manager.installer.step.download.DownloadBaseStep
import dev.beefers.vendetta.manager.installer.step.download.DownloadResourcesStep
import dev.beefers.vendetta.manager.installer.util.ArscUtil
import dev.beefers.vendetta.manager.installer.util.ArscUtil.addColorResource
import dev.beefers.vendetta.manager.installer.util.ArscUtil.addFileResource
import dev.beefers.vendetta.manager.installer.util.ArscUtil.getAllResourceFileNames
import dev.beefers.vendetta.manager.installer.util.ArscUtil.getMainArscChunk
import dev.beefers.vendetta.manager.installer.util.ArscUtil.getPackageChunk
import dev.beefers.vendetta.manager.installer.util.ArscUtil.getResourceFileName
import dev.beefers.vendetta.manager.installer.util.AxmlUtil
import dev.beefers.vendetta.manager.utils.DiscordVersion
import org.koin.core.component.inject

/**
 * Replaces the existing app icons with Kettu tinted ones
 */
class ReplaceIconStep : Step() {

    private val preferences: PreferenceManager by inject()

    val context: Context by inject()

    override val group = StepGroup.PATCHING
    override val nameRes = R.string.step_change_icon

    override suspend fun run(runner: StepRunner) {
        val baseApk = runner.getCompletedStep<DownloadBaseStep>().workingCopy
        val iconBytes = runCatching { context.assets.open("omnicord_icon.png").use { it.readBytes() } }
            .getOrElse { runner.logger.e("Icon asset missing", it); return }
        val iconRscIds = runCatching { AxmlUtil.readManifestIconInfo(baseApk) }
            .getOrElse { runner.logger.e("Could not read manifest icons, keeping Discord's icon", it); return }

        // Every part is guarded: a failed icon change must never block the install.

        // 1) Legacy PNG/WebP icons (installer previews, some launchers): plain file overwrite, no resource table edits.
        runCatching {
            val arsc = ArscUtil.readArsc(baseApk)
            val apks = listOfNotNull(
                baseApk,
                runCatching { runner.getCompletedStep<DownloadResourcesStep>().workingCopy }.getOrNull(),
            )
            val legacy = (arsc.getMainArscChunk().getAllResourceFileNames(iconRscIds.squareIcon) +
                arsc.getMainArscChunk().getAllResourceFileNames(iconRscIds.roundIcon))
                .filter { it.endsWith(".png") || it.endsWith(".webp") }
                .distinct()
            runner.logger.i("Legacy icon files: $legacy")
            for (path in legacy) {
                val target = apks.firstOrNull { apk -> ZipReader(apk).use { it.openEntry(path) != null } } ?: continue
                runner.logger.i("Replacing legacy icon $path in ${target.name}")
                ZipWriter(target, /* append = */ true).use {
                    it.deleteEntry(path)
                    it.writeEntry(path, iconBytes)
                }
            }
        }.onFailure { runner.logger.e("Legacy icon replacement failed", it) }

        // 2) Adaptive icon with our picture as foreground; 3) fallback: background color only (original method).
        val full = runCatching { patchAdaptive(runner, baseApk, iconRscIds, iconBytes, withPicture = true) }
            .onFailure { runner.logger.e("Adaptive icon (picture) failed, falling back to color", it) }
        if (full.isFailure) {
            runCatching { patchAdaptive(runner, baseApk, iconRscIds, iconBytes, withPicture = false) }
                .onFailure { runner.logger.e("Adaptive icon (color) failed, keeping Discord's icon", it) }
        }
    }

    private fun patchAdaptive(
        runner: StepRunner,
        baseApk: java.io.File,
        iconRscIds: AxmlUtil.ManifestIconInfo,
        iconBytes: ByteArray,
        withPicture: Boolean,
    ) {
        // Fresh copy of the resource table so a failed attempt leaves nothing half-modified.
        val arsc = ArscUtil.readArsc(baseApk)
        val squareIconFile = arsc.getMainArscChunk().getResourceFileName(iconRscIds.squareIcon, "anydpi-v26")
        val roundIconFile = arsc.getMainArscChunk().getResourceFileName(iconRscIds.roundIcon, "anydpi-v26")
        runner.logger.i("Patching icon assets (squareIcon=$squareIconFile, roundIcon=$roundIconFile, picture=$withPicture)")

        val backgroundColor = arsc.getPackageChunk().addColorResource("omnicord_color", Color(0xFFBFBFBF))

        val iconPath = "res/omnicord_icon.png"
        val foregroundIcon = if (withPicture) arsc.addFileResource("drawable", "omnicord_icon", iconPath) else null

        val postfix = when (preferences.channel) {
            DiscordVersion.Type.BETA -> "beta"
            DiscordVersion.Type.ALPHA -> "canary"
            else -> null
        }

        // Compute everything first, write to the APK only once nothing threw.
        val arscBytes = arsc.toByteArray()

        if (withPicture) ZipWriter(baseApk, /* append = */ true).use { zip ->
            zip.deleteEntry(iconPath)
            zip.writeEntry(iconPath, iconBytes)
        }

        for (rscFile in setOf(squareIconFile, roundIconFile)) {
            val referencePath = if (postfix == null) rscFile else rscFile.replace("_$postfix.xml", ".xml")
            runner.logger.i("Patching adaptive icon ($rscFile <- $referencePath)")
            AxmlUtil.patchAdaptiveIcon(
                apk = baseApk,
                resourcePath = rscFile,
                referencePath = referencePath,
                backgroundColor = backgroundColor,
                foregroundIcon = foregroundIcon,
            )
        }

        runner.logger.i("Writing and compiling resources.arsc")
        ZipWriter(baseApk, /* append = */ true).use {
            it.deleteEntry("resources.arsc")
            it.writeEntry("resources.arsc", arscBytes)
        }
    }

}
