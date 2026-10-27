package com.pathsense.app

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
import android.os.CombinedVibration
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
 *
 * Implements:
 * 1. 1x1 px transparent anchor (alpha = 0.01) to keep the app in user-visible state
 *    so Android 16 OriginOS does not suspend or mute background camera streaming.
 * 2. Full-screen Edge Glow Overlay drawn across edges (Left, Center/Bottom, Right).
 * 3. Directional Haptic Waveform feedback patterns via VibrationEffect.createWaveform.
 */
class EdgeAlertService : Service(), LifecycleOwner {

    private val lifecycleRegistry = LifecycleRegistry(this)
    override val lifecycle: Lifecycle get() = lifecycleRegistry

    private lateinit var windowManager: WindowManager
    private lateinit var imuTracker: ImuTracker
    private lateinit var obstacleEngine: HomographyObstacleEngine
    private val cameraExecutor = Executors.newSingleThreadExecutor()

    // 1x1 Pixel Keep-Alive Anchor View (Guarantees background camera isn't muted on Android 16)
    private var anchorKeepAliveView: View? = null

    // Screen Edge Glow Alert Overlay View
    private var edgeGlowOverlayView: EdgeGlowView? = null

    private var vibrator: Vibrator? = null
    private val mainHandler = Handler(Looper.getMainLooper())
    private var lastHapticTriggerTimeMs: Long = 0L

    companion object {
        const val CHANNEL_ID = "pathsense_foreground_channel"
        const val NOTIFICATION_ID = 1001

        // Actions
        const val ACTION_START_DOOMSCROLL_MODE = "ACTION_START_DOOMSCROLL_MODE"
        const val ACTION_STOP_DOOMSCROLL_MODE = "ACTION_STOP_DOOMSCROLL_MODE"
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
     * Maintains a 1x1 pixel overlay view with alpha = 0.01 at top-left.
     * Android 16 classifies the app as having an active user-visible surface,
     * preventing camera stream throttling or forced suspension.
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

    /**
     * Full-screen overlay dedicated to drawing edge glow animations when hazards occur.
     */
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

        // Trigger edge glow visuals and haptics
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
        if (now - lastHapticTriggerTimeMs < 400) return // Debounce haptic motor
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

    /**
     * Custom overlay view rendering high-contrast glowing edge bars
     */
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
                Color.argb((fadeAlpha * 240).toInt(), 245, 158, 11) // Amber for Raised Obstacle
            } else {
                Color.argb((fadeAlpha * 255).toInt(), 239, 68, 68) // Crimson Red for Pothole / Drop
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
                    // Flash bottom border and full frame vignette for imminent center hazard
                    glowPaint.shader = LinearGradient(0f, h, 0f, h - edgeThickness * 1.5f, baseColor, transparentColor, Shader.TileMode.CLAMP)
                    canvas.drawRect(0f, h - edgeThickness * 1.5f, w, h, glowPaint)

                    // Also flash top bar subtly
                    glowPaint.shader = LinearGradient(0f, 0f, 0f, edgeThickness * 0.7f, baseColor, transparentColor, Shader.TileMode.CLAMP)
                    canvas.drawRect(0f, 0f, w, edgeThickness * 0.7f, glowPaint)
                }
            }
        }
    }
}
