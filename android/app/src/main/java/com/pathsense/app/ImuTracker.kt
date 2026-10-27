package com.pathsense.app

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

    // Guard thresholds
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
                // Compute total dynamic acceleration norm (gravity is already removed by hardware sensor)
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

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {
        // No-op for high performance
    }

    /**
     * Computes the rolling variance of linear acceleration within the last 300ms.
     * Returns true if user is actively walking, false if standing stationary.
     */
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

    /**
     * Calculates the pixel shift in the image plane caused solely by phone rotational movement:
     * dx_rot = wy * dt * focalLengthPx
     * dy_rot = wx * dt * focalLengthPx
     */
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
}
