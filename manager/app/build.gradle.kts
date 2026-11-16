import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    alias(libs.plugins.aboutlibraries)
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.serialization)
    alias(libs.plugins.compose.compiler)
}

android {
    namespace = "dev.beefers.vendetta.manager"
    compileSdk = 36

    defaultConfig {
        applicationId = "omnicord.manager"
        minSdk = 28
        targetSdk = 36
        // CI sets OMNICORD_BUILD = release tag, so the in-app updater compares correctly
        versionCode = System.getenv("OMNICORD_BUILD")?.toIntOrNull() ?: 1
        versionName = "1.0.${System.getenv("OMNICORD_BUILD") ?: "0-dev"}"

        buildConfigField("String", "GIT_BRANCH", "\"${getCurrentBranch()}\"")
        buildConfigField("String", "GIT_COMMIT", "\"${getLatestCommit()}\"")
        buildConfigField("boolean", "GIT_LOCAL_COMMITS", "${hasLocalCommits()}")
        buildConfigField("boolean", "GIT_LOCAL_CHANGES", "${hasLocalChanges()}")

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        vectorDrawables {
            useSupportLibrary = true
        }
    }


    signingConfigs {
        create("omnicord") {
            // CI: set OMNICORD_KEYSTORE (path), OMNICORD_KEYSTORE_PASSWORD, OMNICORD_KEY_ALIAS, OMNICORD_KEY_PASSWORD.
            // Without them, release builds fall back to the debug key so the APK still installs.
            val ks = System.getenv("OMNICORD_KEYSTORE")
            if (ks != null && file(ks).exists()) {
                storeFile = file(ks)
                storePassword = System.getenv("OMNICORD_KEYSTORE_PASSWORD")
                keyAlias = System.getenv("OMNICORD_KEY_ALIAS")
                keyPassword = System.getenv("OMNICORD_KEY_PASSWORD")
            }
        }
    }
    buildTypes {
        named("release") {
            signingConfig = signingConfigs.getByName(if (System.getenv("OMNICORD_KEYSTORE") != null) "omnicord" else "debug")
            isCrunchPngs = true
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_21
        targetCompatibility = JavaVersion.VERSION_21
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    packaging {
        resources {
            // Reflection symbol list (https://stackoverflow.com/a/41073782/13964629)
            excludes += "/**/*.kotlin_builtins"
        }
    }

    configurations {
        all {
            exclude(module = "listenablefuture")
            exclude(module = "error_prone_annotations")
        }
    }
}

kotlin {
    compilerOptions {
        jvmTarget.set(JvmTarget.JVM_21)
        freeCompilerArgs.add("-Xcontext-receivers")
    }
}

composeCompiler {
    reportsDestination.set(layout.buildDirectory.dir("report"))
}

androidComponents {
    onVariants(selector().withBuildType("release")) {
        it.packaging.resources.excludes.apply {
            // Debug metadata
            add("/**/*.version")
            add("/kotlin-tooling-metadata.json")
            // Kotlin debugging (https://github.com/Kotlin/kotlinx.coroutines/issues/2274)
            add("/DebugProbesKt.bin")
        }
    }
}

dependencies {
    implementation(platform(libs.compose.bom))

    implementation(libs.bundles.accompanist)
    implementation(libs.bundles.androidx)
    implementation(libs.bundles.coil)
    implementation(libs.bundles.compose)
    implementation(libs.bundles.koin)
    implementation(libs.bundles.ktor)
    implementation(libs.bundles.shizuku)
    implementation(libs.bundles.voyager)

    implementation(files("libs/lspatch.aar"))

    implementation(libs.aboutlibraries.core)
    implementation(libs.binaryResources) {
        exclude(module = "checker-qual")
        exclude(module = "jsr305")
        exclude(module = "guava")
    }
    implementation(libs.kotlinx.datetime)
    implementation(libs.kotlinx.collections)
    implementation(libs.zip.android) {
        artifact {
            type = "aar"
        }
    }
}

fun getCurrentBranch(): String? =
    execCommand("git", "symbolic-ref", "--short", "HEAD")

fun getLatestCommit(): String? =
    execCommand("git", "rev-parse", "--short", "HEAD")

fun hasLocalCommits(): Boolean {
    val branch = getCurrentBranch() ?: return false
    return execCommand("git", "log", "origin/$branch..HEAD")?.isNotBlank() ?: false
}

fun hasLocalChanges(): Boolean =
    execCommand("git", "status", "-s")?.isNotEmpty() ?: false

fun execCommand(vararg command: String): String? {
    return try {
        val result = providers.exec {
            commandLine(*command)
            isIgnoreExitValue = true
        }

        val err = result.standardError.asText.get()
        if (err.isNotEmpty()) throw Error(err)

        result.standardOutput.asText.get().trim()
    } catch (e: Throwable) {
        e.printStackTrace()
        null
    }
}
