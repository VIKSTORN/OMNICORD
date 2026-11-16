plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    kotlin("plugin.serialization") version "2.1.10"
}

android {
    namespace = "cocobo1.pupu.xposed"
    compileSdk = 36

    defaultConfig {
        applicationId = "cocobo1.pupu.xposed"
        minSdk = 24
        targetSdk = 36
        versionCode = 1420
        versionName = "1.4.2"
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
        debug {
            isDebuggable = true
            isMinifyEnabled = false
            applicationIdSuffix = ".debug"
        }
        release {
            isDebuggable = false
            signingConfig = signingConfigs.getByName(if (System.getenv("OMNICORD_KEYSTORE") != null) "omnicord" else "debug")
            isMinifyEnabled = false
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_1_8
        targetCompatibility = JavaVersion.VERSION_1_8
    }
    kotlinOptions {
        jvmTarget = "1.8"
    }
    buildFeatures {
        buildConfig = true
    }
}

dependencies {
    compileOnly("de.robv.android.xposed:api:82")

    implementation("androidx.core:core-ktx:1.17.0")
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.9.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.10.2")
    implementation("io.ktor:ktor-client-core:3.3.1")
    implementation("io.ktor:ktor-client-cio:3.3.1")
    implementation("dev.rushii:libunbound:1.0.0")
}
