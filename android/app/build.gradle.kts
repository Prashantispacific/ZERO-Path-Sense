plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.pathsense.app"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.pathsense.app"
        minSdk = 29
        targetSdk = 35
        versionCode = 1
        versionName = "1.0.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"

        ndk {
            // Target 64-bit ARM architecture of modern devices like Vivo T3 5G (Dimensity 7200 / ARM64-v8a)
            abiFilters.addAll(setOf("arm64-v8a", "armeabi-v7a"))
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
        debug {
            isMinifyEnabled = false
            // Fast build optimizations for Core i3-1215U
            splits.abi.isEnable = false
            splits.density.isEnable = false
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
        freeCompilerArgs += listOf(
            "-opt-in=kotlin.RequiresOptIn",
            "-Xjvm-default=all"
        )
    }

    buildFeatures {
        viewBinding = true
    }

    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
        }
    }
}

dependencies {
    // AndroidX & UI Essentials (Lightweight Canvas / View based - NO COMPOSE)
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("com.google.android.material:material:1.12.0")
    implementation("androidx.constraintlayout:constraintlayout:2.2.0")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.7")

    // CameraX 1.4.1 (Stable, zero-copy ImageAnalysis YUV_420_888 ingestion)
    val cameraxVersion = "1.4.1"
    implementation("androidx.camera:camera-core:$cameraxVersion")
    implementation("androidx.camera:camera-camera2:$cameraxVersion")
    implementation("androidx.camera:camera-lifecycle:$cameraxVersion")
    implementation("androidx.camera:camera-view:$cameraxVersion")

    // Official Pre-compiled OpenCV Android AAR (NO CMake/NDK compilation required on laptop!)
    // Executes calcOpticalFlowPyrLK, findHomography, perspectiveTransform in native C++
    implementation("com.quickbirdstudios:opencv:4.5.3.0")

    // Coroutines for background camera & sensor dispatchers
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.9.0")
}
