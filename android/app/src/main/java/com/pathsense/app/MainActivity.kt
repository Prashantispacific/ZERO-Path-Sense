package com.pathsense.app

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

    // Request permissions contract
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

        // Initialize pre-compiled OpenCV native binaries
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

    /**
     * Binds CameraX Preview and ImageAnalysis with STRATEGY_KEEP_ONLY_LATEST
     * target resolution 320x240 for ultra-low latency (<8ms per frame).
     */
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
                    // Push result to Custom Canvas View
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
        // SeekBar 1: Anomaly Threshold (0.20 to 1.00)
        // Range: progress 0..80 -> value = 0.20 + (progress / 100f)
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

        // SeekBar 2: Debounce Frames (1 to 6)
        // Range: progress 0..5 -> value = progress + 1
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
                // Check SYSTEM_ALERT_WINDOW permission
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(this)) {
                    val intent = Intent(
                        Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                        Uri.parse("package:$packageName")
                    )
                    startActivity(intent)
                    Toast.makeText(this, "Enable 'Display over other apps' to use Doomscroll Mode", Toast.LENGTH_LONG).show()
                    return@setOnClickListener
                }

                // Start Foreground Service
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
}
