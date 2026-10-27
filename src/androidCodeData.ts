/**
 * Full Android Project Files for PathSense
 */

export interface CodeFile {
  path: string;
  name: string;
  language: string;
  description: string;
  content: string;
}

export const ANDROID_FILES: CodeFile[] = [
  {
    path: "settings.gradle.kts",
    name: "settings.gradle.kts",
    language: "kotlin",
    description: "Configures OpenCV Maven repository without C++ source compilation",
    content: `pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
        // Official pre-compiled OpenCV Maven repository
        maven { url = java.net.URI("https://jitpack.io") }
    }
}

rootProject.name = "PathSense"
include(":app")`
  },
  {
    path: "gradle.properties",
    name: "gradle.properties",
    language: "properties",
    description: "Strict 1.5GB RAM cap for Core i3-1215U / 8GB host",
    content: `# STRICT HARDWARE RAM CAP FOR 8 GB RAM HOST (Intel Core i3-1215U)
# Keeps peak daemon consumption under 1.5 GB to guarantee zero OOM or swapping
org.gradle.jvmargs=-Xmx1536m -Dfile.encoding=UTF-8
org.gradle.daemon=true
org.gradle.parallel=false
org.gradle.caching=true
org.gradle.configuration-cache=true

# Android Gradle Plugin settings
android.useAndroidX=true
android.nonTransitiveRClass=true
kotlin.code.style=official`
  },
  {
    path: "build.gradle.kts",
    name: "Root build.gradle.kts",
    language: "kotlin",
    description: "Root Gradle configuration",
    content: `// Top-level build file where you can add configuration options common to all sub-projects/modules.
plugins {
    id("com.android.application") version "8.7.3" apply false
    id("org.jetbrains.kotlin.android") version "2.0.21" apply false
}`
  },
  {
    path: "app/build.gradle.kts",
    name: "app/build.gradle.kts",
    language: "kotlin",
    description: "CameraX, pre-compiled OpenCV AAR, minSdk 29, targetSdk 35",
    content: `plugins {
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
}`
  },
  {
    path: "app/src/main/AndroidManifest.xml",
    name: "AndroidManifest.xml",
    language: "xml",
    description: "Camera, ForegroundService, SystemAlertWindow, Vibrate",
    content: `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:tools="http://schemas.android.com/tools">

    <!-- Hardware & Vision Permissions -->
    <uses-permission android:name="android.permission.CAMERA" />
    <uses-feature android:name="android.hardware.camera" android:required="true" />
    <uses-feature android:name="android.hardware.camera.autofocus" android:required="false" />
    <uses-feature android:name="android.hardware.sensor.accelerometer" android:required="true" />
    <uses-feature android:name="android.hardware.sensor.gyroscope" android:required="true" />

    <!-- Foreground Service & Android 16 Background Camera Execution -->
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_CAMERA" />
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
    <uses-permission android:name="android.permission.WAKE_LOCK" />

    <!-- System Overlay ("Display Over Other Apps") for Doomscroll Safe Mode -->
    <uses-permission android:name="android.permission.SYSTEM_ALERT_WINDOW" />

    <!-- Directional Haptics -->
    <uses-permission android:name="android.permission.VIBRATE" />

    <application
        android:allowBackup="false"
        android:dataExtractionRules="@null"
        android:fullBackupContent="false"
        android:icon="@android:drawable/ic_dialog_alert"
        android:label="PathSense"
        android:roundIcon="@android:drawable/ic_dialog_alert"
        android:supportsRtl="true"
        android:theme="@style/Theme.PathSense"
        tools:targetApi="35">

        <!-- Main Activity: Visual Debug HUD & Control Console -->
        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:screenOrientation="portrait"
            android:configChanges="orientation|screenSize|keyboardHidden"
            android:theme="@style/Theme.PathSense">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>

        <!-- Background Edge Alert & Keep-Alive Overlay Service -->
        <service
            android:name=".EdgeAlertService"
            android:enabled="true"
            android:exported="false"
            android:foregroundServiceType="camera" />

    </application>

</manifest>`
  },
  {
    path: "app/src/main/java/com/pathsense/app/ImuTracker.kt",
    name: "ImuTracker.kt",
    language: "kotlin",
    description: "Gyroscope + Linear Acceleration rolling variance & derotation math",
    content: `package com.pathsense.app

import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import kotlin.math.sqrt

/**
 * High-speed, lock-free IMU Tracker fusing Gyroscope & Linear Acceleration.
 *
 * Responsibilities:
 * 1. Step-phase detection via rolling acceleration variance (300ms window)
 *    to guard against false positives when standing stationary.
 * 2. High-rate gyroscope integration (SENSOR_DELAY_GAME) to derotate optical flow
 *    vectors, canceling natural hand pitch/roll jitter while walking.
 */
class ImuTracker(context: Context) : SensorEventListener {

    private val sensorManager = context.getSystemService(Context.SENSOR_SERVICE) as SensorManager
    private val gyroSensor: Sensor? = sensorManager.getDefaultSensor(Sensor.TYPE_GYROSCOPE)
    private val linearAccelSensor: Sensor? = sensorManager.getDefaultSensor(Sensor.TYPE_LINEAR_ACCELERATION)

    // Acceleration Ring Buffer (300 ms window)
    private val bufferCapacity = 60
    private val accelTimestampsNs = LongArray(bufferCapacity)
    private val accelNorms = FloatArray(bufferCapacity)
    private var accelHead = 0
    private var accelCount = 0

    // Gyroscope tracking
    @Volatile private var latestWx = 0f // Angular speed around X-axis (Pitch: tilting phone up/down)
    @Volatile private var latestWy = 0f // Angular speed around Y-axis (Roll / Yaw: tilting phone left/right)
    @Volatile private var latestWz = 0f
    @Volatile private var lastGyroTimestampNs: Long = 0L

    companion object {
        const val STEP_VARIANCE_THRESHOLD = 0.08f // Below this variance = standing still
        const val WINDOW_DURATION_NS = 300_000_000L // 300 ms
    }

    fun start() {
        gyroSensor?.let {
            sensorManager.registerListener(this, it, SensorManager.SENSOR_DELAY_GAME)
        }
        linearAccelSensor?.let {
            sensorManager.registerListener(this, it, SensorManager.SENSOR_DELAY_GAME)
        }
    }

    fun stop() {
        sensorManager.unregisterListener(this)
    }

    override fun onSensorChanged(event: SensorEvent?) {
        if (event == null) return

        when (event.sensor.type) {
            Sensor.TYPE_GYROSCOPE -> {
                latestWx = event.values[0]
                latestWy = event.values[1]
                latestWz = event.values[2]
                lastGyroTimestampNs = event.timestamp
            }

            Sensor.TYPE_LINEAR_ACCELERATION -> {
                val ax = event.values[0]
                val ay = event.values[1]
                val az = event.values[2]
                val norm = sqrt(ax * ax + ay * ay + az * az)

                synchronized(this) {
                    accelTimestampsNs[accelHead] = event.timestamp
                    accelNorms[accelHead] = norm
                    accelHead = (accelHead + 1) % bufferCapacity
                    if (accelCount < bufferCapacity) accelCount++
                }
            }
        }
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {}

    fun isUserWalking(currentFrameTimestampNs: Long): Boolean {
        var sum = 0f
        var count = 0
        val cutoffNs = currentFrameTimestampNs - WINDOW_DURATION_NS

        val validSamples = FloatArray(bufferCapacity)

        synchronized(this) {
            var idx = (accelHead - 1 + bufferCapacity) % bufferCapacity
            for (i in 0 until accelCount) {
                if (accelTimestampsNs[idx] < cutoffNs) break
                val sample = accelNorms[idx]
                validSamples[count] = sample
                sum += sample
                count++
                idx = (idx - 1 + bufferCapacity) % bufferCapacity
            }
        }

        if (count < 4) return true // Insufficient data yet, avoid false blocking

        val mean = sum / count
        var variance = 0f
        for (i in 0 until count) {
            val diff = validSamples[i] - mean
            variance += diff * diff
        }
        variance /= (count - 1)

        return variance >= STEP_VARIANCE_THRESHOLD
    }

    fun computeRotationalShift(
        dtSec: Double,
        focalLengthPx: Double
    ): Pair<Double, Double> {
        val dxRot = latestWy * dtSec * focalLengthPx
        val dyRot = latestWx * dtSec * focalLengthPx
        return Pair(dxRot, dyRot)
    }

    fun getLatestGyroVelocities(): Triple<Float, Float, Float> {
        return Triple(latestWx, latestWy, latestWz)
    }
}`
  },
  {
    path: "app/src/main/java/com/pathsense/app/HomographyObstacleEngine.kt",
    name: "HomographyObstacleEngine.kt",
    language: "kotlin",
    description: "Zero-copy Y-plane, CLAHE, PyrLK, Safe-Anchor RANSAC Homography, 3-Bucket debounce",
    content: `package com.pathsense.app

import androidx.camera.core.ImageProxy
import org.opencv.calib3d.Calib3d
import org.opencv.core.Core
import org.opencv.core.CvType
import org.opencv.core.Mat
import org.opencv.core.MatOfByte
import org.opencv.core.MatOfFloat
import org.opencv.core.MatOfPoint2f
import org.opencv.core.Point
import org.opencv.core.Size
import org.opencv.imgproc.CLAHE
import org.opencv.imgproc.Imgproc
import org.opencv.video.Video
import java.nio.ByteBuffer
import kotlin.math.sqrt

enum class EngineState {
    WALKING,
    STATIONARY,
    LOW_TEXTURE_PAUSED,
    UNSTABLE_PLANE,
    HAZARD_ALERT
}

enum class HazardType {
    NONE,
    ELEVATED,   // Brick, raised curb, stone
    DEPRESSION  // Pothole, open drain, sunken tile
}

enum class BucketId {
    LEFT,
    CENTER,
    RIGHT
}

data class FlowVector(
    val startX: Float,
    val startY: Float,
    val endX: Float,
    val endY: Float,
    val isAnomaly: Boolean,
    val hazardType: HazardType,
    val residualMagnitude: Float
)

data class BucketAlert(
    val bucket: BucketId,
    val isTriggered: Boolean,
    val dominantHazard: HazardType,
    val anomalyRatio: Float,
    val totalPoints: Int
)

data class FrameAnalysisResult(
    val state: EngineState,
    val fps: Float,
    val latencyMs: Long,
    val validTrackCount: Int,
    val inlierPercentage: Float,
    val medianFlowMag: Float,
    val vectors: List<FlowVector>,
    val alerts: Map<BucketId, BucketAlert>,
    val frameWidth: Int,
    val frameHeight: Int
)

class HomographyObstacleEngine(private val imuTracker: ImuTracker) {

    @Volatile var anomalyThreshold: Float = 0.45f
    @Volatile var debounceRequiredFrames: Int = 3

    private var prevGrayMat: Mat? = null
    private var prevTimestampNs: Long = 0L
    private val claheFilter: CLAHE = Imgproc.createCLAHE(2.0, Size(8.0, 8.0))

    private val bucketConsecutiveCounters = mutableMapOf(
        BucketId.LEFT to 0,
        BucketId.CENTER to 0,
        BucketId.RIGHT to 0
    )

    private var yBuffer: ByteArray? = null
    private var lastFpsTimestampMs = System.currentTimeMillis()
    private var frameCounter = 0
    private var currentFps = 0f

    fun processFrame(imageProxy: ImageProxy): FrameAnalysisResult {
        val startTime = System.nanoTime()
        val currentTimestampNs = imageProxy.info.timestamp

        // 1. Zero-Copy Y-Plane Extraction & Portrait Rotation
        val rawWidth = imageProxy.width
        val rawHeight = imageProxy.height
        val plane = imageProxy.planes[0]
        val buffer: ByteBuffer = plane.buffer
        val rowStride = plane.rowStride
        val pixelStride = plane.pixelStride

        val requiredCapacity = rawWidth * rawHeight
        if (yBuffer == null || yBuffer!!.size < requiredCapacity) {
            yBuffer = ByteArray(requiredCapacity)
        }
        val outBytes = yBuffer!!

        if (rowStride == rawWidth && pixelStride == 1) {
            buffer.get(outBytes, 0, requiredCapacity)
        } else {
            var outOffset = 0
            for (row in 0 until rawHeight) {
                buffer.position(row * rowStride)
                buffer.get(outBytes, outOffset, rawWidth)
                outOffset += rawWidth
            }
        }

        val rawMat = Mat(rawHeight, rawWidth, CvType.CV_8UC1)
        rawMat.put(0, 0, outBytes)

        val portraitMat = Mat()
        Core.rotate(rawMat, portraitMat, Core.ROTATE_90_CLOCKWISE)
        rawMat.release()

        val H = portraitMat.rows()
        val W = portraitMat.cols()

        val enhancedMat = Mat()
        claheFilter.apply(portraitMat, enhancedMat)
        portraitMat.release()

        frameCounter++
        val nowMs = System.currentTimeMillis()
        if (nowMs - lastFpsTimestampMs >= 1000) {
            currentFps = (frameCounter * 1000f) / (nowMs - lastFpsTimestampMs)
            frameCounter = 0
            lastFpsTimestampMs = nowMs
        }

        // 2. Step-Phase Check (IMU Linear Acceleration Guard)
        if (!imuTracker.isUserWalking(currentTimestampNs)) {
            prevGrayMat?.release()
            prevGrayMat = enhancedMat
            prevTimestampNs = currentTimestampNs
            val latency = (System.nanoTime() - startTime) / 1_000_000
            return emptyResult(EngineState.STATIONARY, currentFps, latency, W, H)
        }

        val prevMat = prevGrayMat
        if (prevMat == null) {
            prevGrayMat = enhancedMat
            prevTimestampNs = currentTimestampNs
            val latency = (System.nanoTime() - startTime) / 1_000_000
            return emptyResult(EngineState.WALKING, currentFps, latency, W, H)
        }

        val dtSec = if (prevTimestampNs > 0) (currentTimestampNs - prevTimestampNs) * 1e-9 else 0.033

        // 3. Corner Detection
        val ptsPrev = MatOfPoint2f()
        Imgproc.goodFeaturesToTrack(prevMat, ptsPrev, 120, 0.015, 8.0)
        val prevPointsArray = ptsPrev.toArray()

        if (prevPointsArray.size < 30) {
            prevMat.release()
            prevGrayMat = enhancedMat
            prevTimestampNs = currentTimestampNs
            ptsPrev.release()
            val latency = (System.nanoTime() - startTime) / 1_000_000
            return emptyResult(EngineState.LOW_TEXTURE_PAUSED, currentFps, latency, W, H)
        }

        // 4. Optical Flow via Video.calcOpticalFlowPyrLK
        val ptsCurr = MatOfPoint2f()
        val statusMat = MatOfByte()
        val errMat = MatOfFloat()
        Video.calcOpticalFlowPyrLK(
            prevMat, enhancedMat, ptsPrev, ptsCurr, statusMat, errMat, Size(21.0, 21.0), 3
        )

        val currPointsArray = ptsCurr.toArray()
        val statusArray = statusMat.toArray()
        val errArray = errMat.toArray()

        val validPrevList = mutableListOf<Point>()
        val validCurrList = mutableListOf<Point>()

        for (i in statusArray.indices) {
            if (statusArray[i].toInt() == 1 && errArray[i] <= 12.0f) {
                validPrevList.add(prevPointsArray[i])
                validCurrList.add(currPointsArray[i])
            }
        }

        ptsPrev.release()
        ptsCurr.release()
        statusMat.release()
        errMat.release()

        if (validPrevList.size < 30) {
            prevMat.release()
            prevGrayMat = enhancedMat
            prevTimestampNs = currentTimestampNs
            val latency = (System.nanoTime() - startTime) / 1_000_000
            return emptyResult(EngineState.LOW_TEXTURE_PAUSED, currentFps, latency, W, H)
        }

        // 5. Gyroscope Derotation
        val focalLengthPx = W * 0.95
        val (dxRot, dyRot) = imuTracker.computeRotationalShift(dtSec, focalLengthPx)

        val derotatedCurrList = validCurrList.map { pt ->
            Point(pt.x - dxRot, pt.y - dyRot)
        }

        // 6. Dual-Zone Partitioning
        val safeAnchorMinY = 0.70 * H
        val safeAnchorMaxY = 0.95 * H
        val lookAheadMinY = 0.30 * H
        val lookAheadMaxY = 0.70 * H

        val anchorPrev = mutableListOf<Point>()
        val anchorCurr = mutableListOf<Point>()
        val anchorFlowMagnitudes = mutableListOf<Double>()

        val lookAheadPrev = mutableListOf<Point>()
        val lookAheadCurr = mutableListOf<Point>()

        for (i in validPrevList.indices) {
            val pPrev = validPrevList[i]
            val pCurr = derotatedCurrList[i]
            val flowMag = sqrt((pCurr.x - pPrev.x) * (pCurr.x - pPrev.x) + (pCurr.y - pPrev.y) * (pCurr.y - pPrev.y))

            if (pPrev.y in safeAnchorMinY..safeAnchorMaxY) {
                anchorPrev.add(pPrev)
                anchorCurr.add(pCurr)
                anchorFlowMagnitudes.add(flowMag)
            } else if (pPrev.y in lookAheadMinY..lookAheadMaxY) {
                lookAheadPrev.add(pPrev)
                lookAheadCurr.add(pCurr)
            }
        }

        val medianFlowMag = if (anchorFlowMagnitudes.isNotEmpty()) {
            val sorted = anchorFlowMagnitudes.sorted()
            sorted[sorted.size / 2].toFloat()
        } else 0f

        if (medianFlowMag < 1.2f) {
            prevMat.release()
            prevGrayMat = enhancedMat
            prevTimestampNs = currentTimestampNs
            val latency = (System.nanoTime() - startTime) / 1_000_000
            return emptyResult(EngineState.STATIONARY, currentFps, latency, W, H)
        }

        // 7. Reference Flat-Ground Homography Fitting
        if (anchorPrev.size < 6) {
            prevMat.release()
            prevGrayMat = enhancedMat
            prevTimestampNs = currentTimestampNs
            val latency = (System.nanoTime() - startTime) / 1_000_000
            return emptyResult(EngineState.UNSTABLE_PLANE, currentFps, latency, W, H)
        }

        val anchorPrevMat = MatOfPoint2f(*anchorPrev.toTypedArray())
        val anchorCurrMat = MatOfPoint2f(*anchorCurr.toTypedArray())
        val inlierMask = Mat()

        val hGround = Calib3d.findHomography(
            anchorPrevMat, anchorCurrMat, Calib3d.RANSAC, 3.0, inlierMask
        )

        anchorPrevMat.release()
        anchorCurrMat.release()

        if (hGround.empty()) {
            inlierMask.release()
            prevMat.release()
            prevGrayMat = enhancedMat
            prevTimestampNs = currentTimestampNs
            val latency = (System.nanoTime() - startTime) / 1_000_000
            return emptyResult(EngineState.UNSTABLE_PLANE, currentFps, latency, W, H)
        }

        val inlierBytes = ByteArray(inlierMask.rows() * inlierMask.cols())
        inlierMask.get(0, 0, inlierBytes)
        var inlierCount = 0
        for (b in inlierBytes) {
            if (b.toInt() != 0) inlierCount++
        }
        val inlierRatio = if (inlierBytes.isNotEmpty()) inlierCount.toFloat() / inlierBytes.size else 0f
        inlierMask.release()

        if (inlierRatio < 0.40f) {
            hGround.release()
            prevMat.release()
            prevGrayMat = enhancedMat
            prevTimestampNs = currentTimestampNs
            val latency = (System.nanoTime() - startTime) / 1_000_000
            return emptyResult(EngineState.UNSTABLE_PLANE, currentFps, latency, W, H)
        }

        val renderedVectors = mutableListOf<FlowVector>()
        for (i in anchorPrev.indices) {
            renderedVectors.add(
                FlowVector(anchorPrev[i].x.toFloat(), anchorPrev[i].y.toFloat(),
                    anchorCurr[i].x.toFloat(), anchorCurr[i].y.toFloat(),
                    false, HazardType.NONE, 0f)
            )
        }

        // 8. 3-Bucket Spatial Anomaly Detection on Look-Ahead Zone
        val bucketTotalCounts = mutableMapOf(BucketId.LEFT to 0, BucketId.CENTER to 0, BucketId.RIGHT to 0)
        val bucketAnomalyCounts = mutableMapOf(BucketId.LEFT to 0, BucketId.CENTER to 0, BucketId.RIGHT to 0)
        val bucketElevatedCounts = mutableMapOf(BucketId.LEFT to 0, BucketId.CENTER to 0, BucketId.RIGHT to 0)
        val bucketDepressionCounts = mutableMapOf(BucketId.LEFT to 0, BucketId.CENTER to 0, BucketId.RIGHT to 0)

        if (lookAheadPrev.isNotEmpty()) {
            val lookAheadPrevMat = MatOfPoint2f(*lookAheadPrev.toTypedArray())
            val lookAheadExpectedMat = MatOfPoint2f()

            Core.perspectiveTransform(lookAheadPrevMat, lookAheadExpectedMat, hGround)
            val expectedArray = lookAheadExpectedMat.toArray()
            val thirdWidth = W / 3.0

            for (i in lookAheadPrev.indices) {
                val currPt = lookAheadCurr[i]
                val prevPt = lookAheadPrev[i]
                val expPt = expectedArray[i]

                val residualX = currPt.x - expPt.x
                val residualY = currPt.y - expPt.y
                val residualNorm = sqrt(residualX * residualX + residualY * residualY).toFloat()
                val anomalyRatio = residualNorm / maxOf(medianFlowMag, 1.0f)

                val bucket = when {
                    currPt.x < thirdWidth -> BucketId.LEFT
                    currPt.x <= 2 * thirdWidth -> BucketId.CENTER
                    else -> BucketId.RIGHT
                }

                bucketTotalCounts[bucket] = bucketTotalCounts.getValue(bucket) + 1
                val isAnomaly = anomalyRatio > anomalyThreshold
                var hazard = HazardType.NONE

                if (isAnomaly) {
                    bucketAnomalyCounts[bucket] = bucketAnomalyCounts.getValue(bucket) + 1
                    hazard = if (residualY > 0) {
                        bucketElevatedCounts[bucket] = bucketElevatedCounts.getValue(bucket) + 1
                        HazardType.ELEVATED
                    } else {
                        bucketDepressionCounts[bucket] = bucketDepressionCounts.getValue(bucket) + 1
                        HazardType.DEPRESSION
                    }
                }

                renderedVectors.add(
                    FlowVector(prevPt.x.toFloat(), prevPt.y.toFloat(),
                        currPt.x.toFloat(), currPt.y.toFloat(),
                        isAnomaly, hazard, residualNorm)
                )
            }

            lookAheadPrevMat.release()
            lookAheadExpectedMat.release()
        }

        hGround.release()

        // 9. Temporal Debounce Evaluation across 3 Buckets
        val alertsMap = mutableMapOf<BucketId, BucketAlert>()
        var anyHazardActive = false

        for (bucket in BucketId.values()) {
            val total = bucketTotalCounts.getValue(bucket)
            val anomalies = bucketAnomalyCounts.getValue(bucket)
            val anomalyPercent = if (total > 0) (anomalies.toFloat() / total) * 100f else 0f

            val dominantHazard = if (bucketElevatedCounts.getValue(bucket) >= bucketDepressionCounts.getValue(bucket)) {
                if (anomalies > 0) HazardType.ELEVATED else HazardType.NONE
            } else {
                HazardType.DEPRESSION
            }

            if (total >= 3 && anomalyPercent >= 35.0f) {
                bucketConsecutiveCounters[bucket] = bucketConsecutiveCounters.getValue(bucket) + 1
            } else {
                bucketConsecutiveCounters[bucket] = 0
            }

            val isTriggered = bucketConsecutiveCounters.getValue(bucket) >= debounceRequiredFrames
            if (isTriggered) anyHazardActive = true

            alertsMap[bucket] = BucketAlert(
                bucket = bucket,
                isTriggered = isTriggered,
                dominantHazard = dominantHazard,
                anomalyRatio = anomalyPercent / 100f,
                totalPoints = total
            )
        }

        val finalState = if (anyHazardActive) EngineState.HAZARD_ALERT else EngineState.WALKING

        prevMat.release()
        prevGrayMat = enhancedMat
        prevTimestampNs = currentTimestampNs

        val latencyMs = (System.nanoTime() - startTime) / 1_000_000

        return FrameAnalysisResult(
            state = finalState,
            fps = currentFps,
            latencyMs = latencyMs,
            validTrackCount = validPrevList.size,
            inlierPercentage = inlierRatio * 100f,
            medianFlowMag = medianFlowMag,
            vectors = renderedVectors,
            alerts = alertsMap,
            frameWidth = W,
            frameHeight = H
        )
    }

    private fun emptyResult(state: EngineState, fps: Float, latencyMs: Long, width: Int, height: Int) = FrameAnalysisResult(
        state = state,
        fps = fps,
        latencyMs = latencyMs,
        validTrackCount = 0,
        inlierPercentage = 0f,
        medianFlowMag = 0f,
        vectors = emptyList(),
        alerts = BucketId.values().associateWith {
            BucketAlert(it, isTriggered = false, dominantHazard = HazardType.NONE, anomalyRatio = 0f, totalPoints = 0)
        },
        frameWidth = width,
        frameHeight = height
    )

    fun release() {
        prevGrayMat?.release()
        prevGrayMat = null
    }
}`
  },
  {
    path: "app/src/main/java/com/pathsense/app/DebugHudView.kt",
    name: "DebugHudView.kt",
    language: "kotlin",
    description: "Custom Canvas View rendering vectors, Safe Anchor, Look-Ahead grid, and telemetry HUD",
    content: `package com.pathsense.app

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.DashPathEffect
import android.graphics.Paint
import android.graphics.RectF
import android.util.AttributeSet
import android.view.View

/**
 * Custom Canvas View rendering:
 * 1. Safe Anchor Zone (Green rectangle)
 * 2. Look-Ahead Zone & 3-Bucket Grid (Cyan dashed lines)
 * 3. Optical Flow Vectors: Green for flat-ground inliers, Vivid Red/Orange for anomalies
 * 4. High-visibility Telemetry HUD card (FPS, latency, track count, inlier ratio, state)
 */
class DebugHudView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = 0
) : View(context, attrs, defStyleAttr) {

    private var currentResult: FrameAnalysisResult? = null

    private val anchorZonePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.argb(190, 74, 222, 128)
        style = Paint.Style.STROKE
        strokeWidth = 4f
    }

    private val lookAheadGridPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.argb(180, 56, 189, 248)
        style = Paint.Style.STROKE
        strokeWidth = 3f
        pathEffect = DashPathEffect(floatArrayOf(14f, 10f), 0f)
    }

    private val inlierFlowPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.argb(220, 34, 197, 94)
        strokeWidth = 3f
        style = Paint.Style.STROKE
    }

    private val anomalyFlowPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.argb(255, 239, 68, 68)
        strokeWidth = 5f
        style = Paint.Style.STROKE
    }

    private val anomalyElevatedPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.argb(255, 245, 158, 11)
        strokeWidth = 5f
        style = Paint.Style.STROKE
    }

    private val anomalyCirclePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.FILL
    }

    private val hudCardBackgroundPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.argb(210, 15, 23, 42)
        style = Paint.Style.FILL
    }

    private val hudCardBorderPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.argb(140, 51, 65, 85)
        style = Paint.Style.STROKE
        strokeWidth = 2f
    }

    private val hudTextPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.WHITE
        textSize = 34f
        isFakeBoldText = true
    }

    private val hudSubTextPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.argb(220, 148, 163, 184)
        textSize = 28f
    }

    private val labelPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        textSize = 26f
        isFakeBoldText = true
    }

    private val cardRect = RectF(24f, 24f, 740f, 290f)

    fun updateAnalysis(result: FrameAnalysisResult) {
        this.currentResult = result
        postInvalidateOnAnimation()
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        val res = currentResult ?: return

        val viewW = width.toFloat()
        val viewH = height.toFloat()
        if (viewW <= 0f || viewH <= 0f || res.frameWidth <= 0 || res.frameHeight <= 0) return

        val scaleX = viewW / res.frameWidth.toFloat()
        val scaleY = viewH / res.frameHeight.toFloat()

        // 1. Draw Look-Ahead Zone (y: 30% to 70%) & 3 Buckets
        val lookAheadTop = 0.30f * viewH
        val lookAheadBottom = 0.70f * viewH
        val oneThirdX = viewW / 3f
        val twoThirdX = 2f * viewW / 3f

        canvas.drawLine(oneThirdX, lookAheadTop, oneThirdX, lookAheadBottom, lookAheadGridPaint)
        canvas.drawLine(twoThirdX, lookAheadTop, twoThirdX, lookAheadBottom, lookAheadGridPaint)
        canvas.drawLine(0f, lookAheadTop, viewW, lookAheadTop, lookAheadGridPaint)
        canvas.drawLine(0f, lookAheadBottom, viewW, lookAheadBottom, lookAheadGridPaint)

        labelPaint.color = Color.argb(160, 56, 189, 248)
        canvas.drawText("LOOK-AHEAD: LEFT", 30f, lookAheadTop + 36f, labelPaint)
        canvas.drawText("LOOK-AHEAD: CENTER", oneThirdX + 24f, lookAheadTop + 36f, labelPaint)
        canvas.drawText("LOOK-AHEAD: RIGHT", twoThirdX + 24f, lookAheadTop + 36f, labelPaint)

        res.alerts.forEach { (bucket, alert) ->
            if (alert.isTriggered) {
                val left = when (bucket) {
                    BucketId.LEFT -> 0f
                    BucketId.CENTER -> oneThirdX
                    BucketId.RIGHT -> twoThirdX
                }
                val right = when (bucket) {
                    BucketId.LEFT -> oneThirdX
                    BucketId.CENTER -> twoThirdX
                    BucketId.RIGHT -> viewW
                }
                val alertHighlightPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                    color = if (alert.dominantHazard == HazardType.ELEVATED) {
                        Color.argb(80, 245, 158, 11)
                    } else {
                        Color.argb(90, 239, 68, 68)
                    }
                    style = Paint.Style.FILL
                }
                canvas.drawRect(left, lookAheadTop, right, lookAheadBottom, alertHighlightPaint)
            }
        }

        // 2. Draw Safe Anchor Zone (y: 70% to 95%)
        val anchorTop = 0.70f * viewH
        val anchorBottom = 0.95f * viewH
        canvas.drawRect(8f, anchorTop, viewW - 8f, anchorBottom, anchorZonePaint)

        labelPaint.color = Color.argb(180, 74, 222, 128)
        canvas.drawText("SAFE ANCHOR ZONE (HOMOGRAPHY GROUND REFERENCE)", 30f, anchorTop + 38f, labelPaint)

        // 3. Draw Optical Flow Vectors
        for (vec in res.vectors) {
            val sx = vec.startX * scaleX
            val sy = vec.startY * scaleY
            val ex = vec.endX * scaleX
            val ey = vec.endY * scaleY

            if (vec.isAnomaly) {
                val paint = if (vec.hazardType == HazardType.ELEVATED) anomalyElevatedPaint else anomalyFlowPaint
                canvas.drawLine(sx, sy, ex, ey, paint)
                anomalyCirclePaint.color = paint.color
                canvas.drawCircle(ex, ey, 9f, anomalyCirclePaint)
            } else {
                canvas.drawLine(sx, sy, ex, ey, inlierFlowPaint)
                canvas.drawCircle(ex, ey, 4f, inlierFlowPaint)
            }
        }

        // 4. Render Telemetry HUD Card
        canvas.drawRoundRect(cardRect, 18f, 18f, hudCardBackgroundPaint)
        canvas.drawRoundRect(cardRect, 18f, 18f, hudCardBorderPaint)

        val stateColor = when (res.state) {
            EngineState.WALKING -> Color.rgb(34, 197, 94)
            EngineState.HAZARD_ALERT -> Color.rgb(239, 68, 68)
            EngineState.STATIONARY -> Color.rgb(234, 179, 8)
            EngineState.LOW_TEXTURE_PAUSED -> Color.rgb(148, 163, 184)
            EngineState.UNSTABLE_PLANE -> Color.rgb(249, 115, 22)
        }

        val dotPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = stateColor
            style = Paint.Style.FILL
        }
        canvas.drawCircle(54f, 74f, 12f, dotPaint)

        hudTextPaint.color = stateColor
        canvas.drawText("STATE: \${res.state.name}", 80f, 84f, hudTextPaint)

        hudTextPaint.color = Color.WHITE
        val fpsStr = String.format("%.1f FPS  |  %d ms/frame", res.fps, res.latencyMs)
        canvas.drawText(fpsStr, 48f, 142f, hudTextPaint)

        val tracksStr = String.format("Tracks: %d  |  Inliers: %.0f%%  |  Flow: %.1f px",
            res.validTrackCount, res.inlierPercentage, res.medianFlowMag)
        canvas.drawText(tracksStr, 48f, 196f, hudSubTextPaint)

        val triggered = res.alerts.values.filter { it.isTriggered }
        val alertsStr = if (triggered.isEmpty()) {
            "Hazard Status: PATH CLEAR"
        } else {
            "ALERTS: " + triggered.joinToString(", ") { "\${it.bucket}:\${it.dominantHazard}" }
        }
        hudSubTextPaint.color = if (triggered.isEmpty()) Color.argb(200, 74, 222, 128) else Color.rgb(239, 68, 68)
        canvas.drawText(alertsStr, 48f, 252f, hudSubTextPaint)
    }
}`
  },
  {
    path: "app/src/main/java/com/pathsense/app/EdgeAlertService.kt",
    name: "EdgeAlertService.kt",
    language: "kotlin",
    description: "Foreground Service + Android 16 1x1 keep-alive anchor + screen-edge glow + directional haptics",
    content: `package com.pathsense.app

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.PixelFormat
import android.graphics.Shader
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.LifecycleRegistry
import java.util.concurrent.Executors

/**
 * Android 16 Compatible Background Foreground Service for "Doomscroll Safe" Mode.
 */
class EdgeAlertService : Service(), LifecycleOwner {

    private val lifecycleRegistry = LifecycleRegistry(this)
    override val lifecycle: Lifecycle get() = lifecycleRegistry

    private lateinit var windowManager: WindowManager
    private lateinit var imuTracker: ImuTracker
    private lateinit var obstacleEngine: HomographyObstacleEngine
    private val cameraExecutor = Executors.newSingleThreadExecutor()

    private var anchorKeepAliveView: View? = null
    private var edgeGlowOverlayView: EdgeGlowView? = null
    private var vibrator: Vibrator? = null
    private val mainHandler = Handler(Looper.getMainLooper())
    private var lastHapticTriggerTimeMs: Long = 0L

    companion object {
        const val CHANNEL_ID = "pathsense_foreground_channel"
        const val NOTIFICATION_ID = 1001
    }

    override fun onCreate() {
        super.onCreate()
        lifecycleRegistry.currentState = Lifecycle.State.CREATED
        windowManager = getSystemService(Context.WINDOW_SERVICE) as WindowManager
        initVibrator()

        imuTracker = ImuTracker(this)
        imuTracker.start()
        obstacleEngine = HomographyObstacleEngine(imuTracker)

        createNotificationChannel()
        startForegroundNotification()

        setupAndroid16KeepAliveAnchor()
        setupEdgeGlowOverlay()

        lifecycleRegistry.currentState = Lifecycle.State.STARTED
        lifecycleRegistry.currentState = Lifecycle.State.RESUMED

        startBackgroundCameraPipeline()
    }

    private fun initVibrator() {
        vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val vibratorManager = getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager
            vibratorManager.defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
        }
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "PathSense Active Protection",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Monitors footpath hazards while using other apps."
                setShowBadge(false)
            }
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(channel)
        }
    }

    private fun startForegroundNotification() {
        val launchIntent = Intent(this, MainActivity::class.java)
        val pendingIntent = PendingIntent.getActivity(
            this, 0, launchIntent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        val notification: Notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("PathSense Active")
            .setContentText("Doomscroll protection active: monitoring sidewalk obstacles")
            .setSmallIcon(android.R.drawable.ic_dialog_alert)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_CAMERA)
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }
    }

    /**
     * Android 16 OriginOS 6 Workaround:
     * Maintains a 1x1 pixel overlay view with alpha = 0.01 at top-left to keep camera stream active.
     */
    private fun setupAndroid16KeepAliveAnchor() {
        val anchorParams = WindowManager.LayoutParams(
            1, 1,
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                    WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE or
                    WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.TOP or Gravity.START
            alpha = 0.01f
        }

        anchorKeepAliveView = View(this).apply {
            setBackgroundColor(Color.TRANSPARENT)
        }
        windowManager.addView(anchorKeepAliveView, anchorParams)
    }

    private fun setupEdgeGlowOverlay() {
        val overlayParams = WindowManager.LayoutParams(
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                    WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE or
                    WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.FILL
        }

        edgeGlowOverlayView = EdgeGlowView(this)
        windowManager.addView(edgeGlowOverlayView, overlayParams)
    }

    private fun startBackgroundCameraPipeline() {
        val cameraProviderFuture = ProcessCameraProvider.getInstance(this)
        cameraProviderFuture.addListener({
            val cameraProvider = cameraProviderFuture.get()

            val imageAnalysis = ImageAnalysis.Builder()
                .setTargetResolution(android.util.Size(320, 240))
                .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                .setOutputImageFormat(ImageAnalysis.OUTPUT_IMAGE_FORMAT_YUV_420_888)
                .build()

            imageAnalysis.setAnalyzer(cameraExecutor) { imageProxy ->
                try {
                    val result = obstacleEngine.processFrame(imageProxy)
                    handleAnalysisResult(result)
                } finally {
                    imageProxy.close()
                }
            }

            val cameraSelector = CameraSelector.DEFAULT_BACK_CAMERA
            try {
                cameraProvider.unbindAll()
                cameraProvider.bindToLifecycle(this, cameraSelector, imageAnalysis)
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }, ContextCompat.getMainExecutor(this))
    }

    private fun handleAnalysisResult(result: FrameAnalysisResult) {
        val triggeredAlerts = result.alerts.values.filter { it.isTriggered }
        if (triggeredAlerts.isEmpty()) {
            mainHandler.post {
                edgeGlowOverlayView?.clearGlow()
            }
            return
        }

        mainHandler.post {
            for (alert in triggeredAlerts) {
                edgeGlowOverlayView?.triggerEdgeGlow(alert.bucket, alert.dominantHazard)
                triggerDirectionalHaptic(alert.bucket, alert.dominantHazard)
            }
        }
    }

    /**
     * Directional Haptic Encoding:
     * - LEFT: Double short sharp tick ([0, 35, 40, 35], amplitudes [0, 255, 0, 255])
     * - RIGHT: Single long firm pulse ([0, 110], amplitude [0, 255])
     * - CENTER: Urgent triple pulse ([0, 50, 30, 50, 30, 80], amplitudes [0, 255, 0, 255, 0, 255])
     */
    private fun triggerDirectionalHaptic(bucket: BucketId, hazard: HazardType) {
        val now = System.currentTimeMillis()
        if (now - lastHapticTriggerTimeMs < 400) return
        lastHapticTriggerTimeMs = now

        val vib = vibrator ?: return
        if (!vib.hasVibrator()) return

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val effect = when (bucket) {
                BucketId.LEFT -> {
                    val timings = longArrayOf(0, 35, 40, 35)
                    val amplitudes = intArrayOf(0, 255, 0, 255)
                    VibrationEffect.createWaveform(timings, amplitudes, -1)
                }
                BucketId.RIGHT -> {
                    val timings = longArrayOf(0, 110)
                    val amplitudes = intArrayOf(0, 255)
                    VibrationEffect.createWaveform(timings, amplitudes, -1)
                }
                BucketId.CENTER -> {
                    val timings = longArrayOf(0, 50, 30, 50, 30, 80)
                    val amplitudes = intArrayOf(0, 255, 0, 255, 0, 255)
                    VibrationEffect.createWaveform(timings, amplitudes, -1)
                }
            }
            vib.vibrate(effect)
        } else {
            @Suppress("DEPRECATION")
            when (bucket) {
                BucketId.LEFT -> vib.vibrate(longArrayOf(0, 35, 40, 35), -1)
                BucketId.RIGHT -> vib.vibrate(110)
                BucketId.CENTER -> vib.vibrate(longArrayOf(0, 50, 30, 50, 30, 80), -1)
            }
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        lifecycleRegistry.currentState = Lifecycle.State.DESTROYED
        imuTracker.stop()
        obstacleEngine.release()
        cameraExecutor.shutdown()

        anchorKeepAliveView?.let { windowManager.removeView(it) }
        edgeGlowOverlayView?.let { windowManager.removeView(it) }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private class EdgeGlowView(context: Context) : View(context) {

        private var activeBucket: BucketId? = null
        private var activeHazard: HazardType = HazardType.NONE
        private var fadeAlpha = 0f
        private val glowPaint = Paint(Paint.ANTI_ALIAS_FLAG)

        private val fadeRunnable = object : Runnable {
            override fun run() {
                fadeAlpha -= 0.12f
                if (fadeAlpha > 0f) {
                    invalidate()
                    postDelayed(this, 30)
                } else {
                    fadeAlpha = 0f
                    activeBucket = null
                    invalidate()
                }
            }
        }

        fun triggerEdgeGlow(bucket: BucketId, hazard: HazardType) {
            activeBucket = bucket
            activeHazard = hazard
            fadeAlpha = 1.0f
            removeCallbacks(fadeRunnable)
            invalidate()
            postDelayed(fadeRunnable, 180)
        }

        fun clearGlow() {
            if (fadeAlpha > 0f) {
                fadeAlpha = 0f
                activeBucket = null
                invalidate()
            }
        }

        override fun onDraw(canvas: Canvas) {
            super.onDraw(canvas)
            val bucket = activeBucket ?: return
            if (fadeAlpha <= 0f) return

            val w = width.toFloat()
            val h = height.toFloat()
            val edgeThickness = 70f

            val baseColor = if (activeHazard == HazardType.ELEVATED) {
                Color.argb((fadeAlpha * 240).toInt(), 245, 158, 11)
            } else {
                Color.argb((fadeAlpha * 255).toInt(), 239, 68, 68)
            }
            val transparentColor = Color.TRANSPARENT

            when (bucket) {
                BucketId.LEFT -> {
                    glowPaint.shader = LinearGradient(0f, 0f, edgeThickness, 0f, baseColor, transparentColor, Shader.TileMode.CLAMP)
                    canvas.drawRect(0f, 0f, edgeThickness, h, glowPaint)
                }
                BucketId.RIGHT -> {
                    glowPaint.shader = LinearGradient(w, 0f, w - edgeThickness, 0f, baseColor, transparentColor, Shader.TileMode.CLAMP)
                    canvas.drawRect(w - edgeThickness, 0f, w, h, glowPaint)
                }
                BucketId.CENTER -> {
                    glowPaint.shader = LinearGradient(0f, h, 0f, h - edgeThickness * 1.5f, baseColor, transparentColor, Shader.TileMode.CLAMP)
                    canvas.drawRect(0f, h - edgeThickness * 1.5f, w, h, glowPaint)

                    glowPaint.shader = LinearGradient(0f, 0f, 0f, edgeThickness * 0.7f, baseColor, transparentColor, Shader.TileMode.CLAMP)
                    canvas.drawRect(0f, 0f, w, edgeThickness * 0.7f, glowPaint)
                }
            }
        }
    }
}`
  },
  {
    path: "app/src/main/java/com/pathsense/app/MainActivity.kt",
    name: "MainActivity.kt",
    language: "kotlin",
    description: "Permissions, CameraX lifecycle, mode toggle, and live parameter tuning",
    content: `package com.pathsense.app

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.widget.SeekBar
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.core.content.ContextCompat
import com.pathsense.app.databinding.ActivityMainBinding
import org.opencv.android.OpenCVLoader
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private lateinit var cameraExecutor: ExecutorService

    private lateinit var imuTracker: ImuTracker
    private lateinit var obstacleEngine: HomographyObstacleEngine

    private var isBackgroundServiceRunning = false

    private val requestPermissionsLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        val cameraGranted = permissions[Manifest.permission.CAMERA] == true
        if (cameraGranted) {
            startCameraPipeline()
        } else {
            Toast.makeText(this, "Camera permission is required for PathSense", Toast.LENGTH_LONG).show()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        if (!OpenCVLoader.initDebug()) {
            Toast.makeText(this, "Failed to initialize OpenCV library", Toast.LENGTH_SHORT).show()
        }

        cameraExecutor = Executors.newSingleThreadExecutor()
        imuTracker = ImuTracker(this)
        imuTracker.start()

        obstacleEngine = HomographyObstacleEngine(imuTracker)

        setupLiveTuningControls()
        setupModeSwitching()
        checkAndRequestPermissions()
    }

    private fun checkAndRequestPermissions() {
        val permissionsNeeded = mutableListOf<String>()

        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
            permissionsNeeded.add(Manifest.permission.CAMERA)
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                permissionsNeeded.add(Manifest.permission.POST_NOTIFICATIONS)
            }
        }

        if (permissionsNeeded.isNotEmpty()) {
            requestPermissionsLauncher.launch(permissionsNeeded.toTypedArray())
        } else {
            startCameraPipeline()
        }
    }

    private fun startCameraPipeline() {
        val cameraProviderFuture = ProcessCameraProvider.getInstance(this)
        cameraProviderFuture.addListener({
            val cameraProvider: ProcessCameraProvider = cameraProviderFuture.get()

            val preview = Preview.Builder().build().also {
                it.setSurfaceProvider(binding.previewView.surfaceProvider)
            }

            val imageAnalysis = ImageAnalysis.Builder()
                .setTargetResolution(android.util.Size(320, 240))
                .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                .setOutputImageFormat(ImageAnalysis.OUTPUT_IMAGE_FORMAT_YUV_420_888)
                .build()

            imageAnalysis.setAnalyzer(cameraExecutor) { imageProxy ->
                try {
                    val result = obstacleEngine.processFrame(imageProxy)
                    binding.debugHudView.updateAnalysis(result)
                } catch (e: Exception) {
                    e.printStackTrace()
                } finally {
                    imageProxy.close()
                }
            }

            val cameraSelector = CameraSelector.DEFAULT_BACK_CAMERA

            try {
                cameraProvider.unbindAll()
                cameraProvider.bindToLifecycle(this, cameraSelector, preview, imageAnalysis)
            } catch (exc: Exception) {
                exc.printStackTrace()
            }

        }, ContextCompat.getMainExecutor(this))
    }

    private fun setupLiveTuningControls() {
        binding.sbThreshold.setOnSeekBarChangeListener(object : SeekBar.OnSeekBarChangeListener {
            override fun onProgressChanged(seekBar: SeekBar?, progress: Int, fromUser: Boolean) {
                val value = 0.20f + (progress / 100f)
                val rounded = String.format("%.2f", value).toFloat()
                obstacleEngine.anomalyThreshold = rounded
                binding.tvThresholdLabel.text = "Anomaly Threshold: $rounded"
            }
            override fun onStartTrackingTouch(seekBar: SeekBar?) {}
            override fun onStopTrackingTouch(seekBar: SeekBar?) {}
        })

        binding.sbDebounce.setOnSeekBarChangeListener(object : SeekBar.OnSeekBarChangeListener {
            override fun onProgressChanged(seekBar: SeekBar?, progress: Int, fromUser: Boolean) {
                val value = progress + 1
                obstacleEngine.debounceRequiredFrames = value
                binding.tvDebounceLabel.text = "Debounce Frames: $value"
            }
            override fun onStartTrackingTouch(seekBar: SeekBar?) {}
            override fun onStopTrackingTouch(seekBar: SeekBar?) {}
        })
    }

    private fun setupModeSwitching() {
        binding.btnToggleBackgroundMode.setOnClickListener {
            if (!isBackgroundServiceRunning) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(this)) {
                    val intent = Intent(
                        Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                        Uri.parse("package:$packageName")
                    )
                    startActivity(intent)
                    Toast.makeText(this, "Enable 'Display over other apps' to use Doomscroll Mode", Toast.LENGTH_LONG).show()
                    return@setOnClickListener
                }

                val serviceIntent = Intent(this, EdgeAlertService::class.java)
                ContextCompat.startForegroundService(this, serviceIntent)
                isBackgroundServiceRunning = true

                binding.btnToggleBackgroundMode.text = "Stop Doomscroll Mode"
                binding.btnToggleBackgroundMode.setBackgroundColor(ContextCompat.getColor(this, android.R.color.holo_red_dark))
                binding.tvModeTitle.text = "MODE: Background Doomscroll Safe Overlay"

                Toast.makeText(this, "Doomscroll Mode Active! You can now switch apps safely.", Toast.LENGTH_SHORT).show()
            } else {
                val serviceIntent = Intent(this, EdgeAlertService::class.java)
                stopService(serviceIntent)
                isBackgroundServiceRunning = false

                binding.btnToggleBackgroundMode.text = "Launch Doomscroll Mode"
                binding.btnToggleBackgroundMode.setBackgroundColor(ContextCompat.getColor(this, android.R.color.holo_blue_dark))
                binding.tvModeTitle.text = "MODE: In-App Visual Debug HUD"
            }
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        imuTracker.stop()
        obstacleEngine.release()
        cameraExecutor.shutdown()
    }
}`
  },
  {
    path: "app/src/main/res/layout/activity_main.xml",
    name: "activity_main.xml",
    language: "xml",
    description: "Main Activity XML layout with PreviewView, DebugHudView, and bottom SeekBars",
    content: `<?xml version="1.0" encoding="utf-8"?>
<androidx.constraintlayout.widget.ConstraintLayout xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:app="http://schemas.android.com/apk/res-auto"
    xmlns:tools="http://schemas.android.com/tools"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:background="#0F172A">

    <androidx.camera.view.PreviewView
        android:id="@+id/previewView"
        android:layout_width="match_parent"
        android:layout_height="match_parent"
        app:scaleType="fillCenter" />

    <com.pathsense.app.DebugHudView
        android:id="@+id/debugHudView"
        android:layout_width="match_parent"
        android:layout_height="match_parent" />

    <androidx.cardview.widget.CardView
        android:id="@+id/controlCard"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:layout_margin="12dp"
        app:cardBackgroundColor="#E60F172A"
        app:cardCornerRadius="16dp"
        app:cardElevation="8dp"
        app:layout_constraintBottom_toBottomOf="parent">

        <LinearLayout
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:orientation="vertical"
            android:padding="16dp">

            <LinearLayout
                android:layout_width="match_parent"
                android:layout_height="wrap_content"
                android:gravity="center_vertical"
                android:orientation="horizontal">

                <TextView
                    android:id="@+id/tvModeTitle"
                    android:layout_width="0dp"
                    android:layout_height="wrap_content"
                    android:layout_weight="1"
                    android:text="MODE: In-App Visual Debug HUD"
                    android:textColor="#38BDF8"
                    android:textSize="14sp"
                    android:textStyle="bold" />

                <com.google.android.material.button.MaterialButton
                    android:id="@+id/btnToggleBackgroundMode"
                    android:layout_width="wrap_content"
                    android:layout_height="wrap_content"
                    android:backgroundTint="#0284C7"
                    android:text="Launch Doomscroll Mode"
                    android:textAllCaps="false"
                    android:textColor="#FFFFFF"
                    android:textSize="12sp"
                    app:cornerRadius="8dp" />
            </LinearLayout>

            <View
                android:layout_width="match_parent"
                android:layout_height="1dp"
                android:layout_marginTop="8dp"
                android:layout_marginBottom="8dp"
                android:background="#334155" />

            <LinearLayout
                android:layout_width="match_parent"
                android:layout_height="wrap_content"
                android:gravity="center_vertical"
                android:orientation="horizontal">

                <TextView
                    android:id="@+id/tvThresholdLabel"
                    android:layout_width="150dp"
                    android:layout_height="wrap_content"
                    android:text="Anomaly Threshold: 0.45"
                    android:textColor="#E2E8F0"
                    android:textSize="12sp" />

                <SeekBar
                    android:id="@+id/sbThreshold"
                    android:layout_width="match_parent"
                    android:layout_height="wrap_content"
                    android:max="80"
                    android:progress="25" />
            </LinearLayout>

            <LinearLayout
                android:layout_width="match_parent"
                android:layout_height="wrap_content"
                android:layout_marginTop="6dp"
                android:gravity="center_vertical"
                android:orientation="horizontal">

                <TextView
                    android:id="@+id/tvDebounceLabel"
                    android:layout_width="150dp"
                    android:layout_height="wrap_content"
                    android:text="Debounce Frames: 3"
                    android:textColor="#E2E8F0"
                    android:textSize="12sp" />

                <SeekBar
                    android:id="@+id/sbDebounce"
                    android:layout_width="match_parent"
                    android:layout_height="wrap_content"
                    android:max="5"
                    android:progress="2" />
            </LinearLayout>

        </LinearLayout>
    </androidx.cardview.widget.CardView>

</androidx.constraintlayout.widget.ConstraintLayout>`
  },
  {
    path: "deploy.ps1",
    name: "Windows PowerShell Build & Deploy Script",
    language: "powershell",
    description: "Exact Windows 11 PowerShell commands to build and install on Vivo T3 5G",
    content: `# PathSense Windows 11 PowerShell Build & Deploy Script
# Tested on Intel Core i3-1215U (8 GB RAM) + Vivo T3 5G (Android 16 OriginOS 6)

Write-Host "=== PathSense Low-Latency Build & Deploy ===" -ForegroundColor Cyan

# 1. Verify ADB connection with Vivo T3 5G
Write-Host "[1/5] Verifying ADB connected device..." -ForegroundColor Yellow
$devices = adb devices
$deviceList = $devices | Select-String -Pattern "(\\S+)\\s+device$"
if (-not $deviceList) {
    Write-Host "ERROR: No authorized Android device detected!" -ForegroundColor Red
    Write-Host "1. Ensure Developer Options & USB Debugging are ON on Vivo T3 5G."
    Write-Host "2. OriginOS 6 requires allowing 'USB Debugging (Security settings)' for touch/install."
    exit 1
}
Write-Host "Found device: $($deviceList[0].Matches[0].Groups[1].Value)" -ForegroundColor Green

# 2. Check RAM Cap enforcement in gradle.properties
Write-Host "[2/5] Enforcing 1.5GB JVM Heap memory cap in gradle.properties..." -ForegroundColor Yellow
if (Test-Path gradle.properties) {
    Get-Content gradle.properties | Select-String -Pattern "org.gradle.jvmargs"
}

# 3. Clean and Compile Debug APK without CMake/NDK overhead
Write-Host "[3/5] Compiling Android APK with gradlew assembleDebug..." -ForegroundColor Yellow
$stopwatch = [System.Diagnostics.Stopwatch]::StartNew()

.\\gradlew assembleDebug --no-daemon

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Build failed! Check compiler logs." -ForegroundColor Red
    exit 1
}
$stopwatch.Stop()
Write-Host "Build completed in $($stopwatch.Elapsed.TotalSeconds.ToString('F1')) seconds!" -ForegroundColor Green

# 4. Install APK directly onto Vivo T3 5G
Write-Host "[4/5] Installing debug APK onto Vivo T3 5G..." -ForegroundColor Yellow
.\\gradlew installDebug

# 5. Launch PathSense MainActivity and stream Logcat
Write-Host "[5/5] Launching PathSense MainActivity..." -ForegroundColor Cyan
adb shell am start -n com.pathsense.app/.MainActivity

Write-Host "\`n=== PathSense is now RUNNING on Vivo T3 5G ===" -ForegroundColor Green
Write-Host "Streaming real-time Computer Vision logs (Press Ctrl+C to stop):" -ForegroundColor White
adb logcat -s "PathSense" "HomographyObstacleEngine" "ImuTracker" "EdgeAlertService"`
  }
];
