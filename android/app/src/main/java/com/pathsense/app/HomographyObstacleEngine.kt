package com.pathsense.app

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

    // Configurable parameters with thread-safe access
    @Volatile var anomalyThreshold: Float = 0.45f
    @Volatile var debounceRequiredFrames: Int = 3

    // State tracking across frames
    private var prevGrayMat: Mat? = null
    private var prevTimestampNs: Long = 0L
    private val claheFilter: CLAHE = Imgproc.createCLAHE(2.0, Size(8.0, 8.0))

    // Temporal debouncing buffers
    private val bucketConsecutiveCounters = mutableMapOf(
        BucketId.LEFT to 0,
        BucketId.CENTER to 0,
        BucketId.RIGHT to 0
    )

    // Reusable byte array for Y-plane extraction to prevent GC allocations
    private var yBuffer: ByteArray? = null

    // Telemetry tracking
    private var lastFpsTimestampMs = System.currentTimeMillis()
    private var frameCounter = 0
    private var currentFps = 0f

    /**
     * Ingests a CameraX ImageProxy (YUV_420_888), extracts Y-channel, applies CLAHE,
     * tracks corners via PyrLK, derotates flow with IMU Gyro, fits Safe-Anchor Homography,
     * and evaluates 3-Bucket spatial residuals.
     */
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

        // Handle possible rowStride padding efficiently
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

        // Wrap into OpenCV Mat: raw landscape matrix
        val rawMat = Mat(rawHeight, rawWidth, CvType.CV_8UC1)
        rawMat.put(0, 0, outBytes)

        // Rotate 90 degrees clockwise to match portrait screen orientation (e.g., 320x240 -> 240x320)
        val portraitMat = Mat()
        Core.rotate(rawMat, portraitMat, Core.ROTATE_90_CLOCKWISE)
        rawMat.release()

        val H = portraitMat.rows() // e.g. 320
        val W = portraitMat.cols() // e.g. 240

        // Apply CLAHE contrast enhancement for dull concrete sidewalks
        val enhancedMat = Mat()
        claheFilter.apply(portraitMat, enhancedMat)
        portraitMat.release()

        // FPS calculation
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
            // First frame initialization
            prevGrayMat = enhancedMat
            prevTimestampNs = currentTimestampNs
            val latency = (System.nanoTime() - startTime) / 1_000_000
            return emptyResult(EngineState.WALKING, currentFps, latency, W, H)
        }

        val dtSec = if (prevTimestampNs > 0) (currentTimestampNs - prevTimestampNs) * 1e-9 else 0.033

        // 3. Feature Detection in Previous Frame
        val ptsPrev = MatOfPoint2f()
        Imgproc.goodFeaturesToTrack(
            prevMat,
            ptsPrev,
            120,          // maxCorners
            0.015,        // qualityLevel
            8.0           // minDistance
        )

        val prevPointsArray = ptsPrev.toArray()
        if (prevPointsArray.size < 30) {
            // BLINDNESS GUARD: Dark or ultra-low texture environment
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
            prevMat,
            enhancedMat,
            ptsPrev,
            ptsCurr,
            statusMat,
            errMat,
            Size(21.0, 21.0),
            3
        )

        val currPointsArray = ptsCurr.toArray()
        val statusArray = statusMat.toArray()
        val errArray = errMat.toArray()

        // Filter valid tracked points
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

        // 5. Gyroscope Derotation (Canceling Hand Pitch & Roll Jitter)
        val focalLengthPx = W * 0.95 // Approximated focal length in pixels for portrait
        val (dxRot, dyRot) = imuTracker.computeRotationalShift(dtSec, focalLengthPx)

        val derotatedCurrList = validCurrList.map { pt ->
            Point(pt.x - dxRot, pt.y - dyRot)
        }

        // 6. Dual-Zone Partitioning: Safe Anchor vs Look-Ahead Zone
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

        // Compute median flow speed normalizer from Safe Anchor Zone
        val medianFlowMag = if (anchorFlowMagnitudes.isNotEmpty()) {
            val sorted = anchorFlowMagnitudes.sorted()
            sorted[sorted.size / 2].toFloat()
        } else {
            0f
        }

        if (medianFlowMag < 1.2f) {
            // Flow is practically zero -> user is paused or stationary
            prevMat.release()
            prevGrayMat = enhancedMat
            prevTimestampNs = currentTimestampNs
            val latency = (System.nanoTime() - startTime) / 1_000_000
            return emptyResult(EngineState.STATIONARY, currentFps, latency, W, H)
        }

        // 7. Reference Flat-Ground Homography Fitting (RANSAC on Anchor Zone)
        var inlierRatio = 0f
        val renderedVectors = mutableListOf<FlowVector>()

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
            anchorPrevMat,
            anchorCurrMat,
            Calib3d.RANSAC,
            3.0,
            inlierMask
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

        // Count inliers
        val inlierBytes = ByteArray(inlierMask.rows() * inlierMask.cols())
        inlierMask.get(0, 0, inlierBytes)
        var inlierCount = 0
        for (b in inlierBytes) {
            if (b.toInt() != 0) inlierCount++
        }
        inlierRatio = if (inlierBytes.isNotEmpty()) inlierCount.toFloat() / inlierBytes.size else 0f
        inlierMask.release()

        if (inlierRatio < 0.40f) {
            hGround.release()
            prevMat.release()
            prevGrayMat = enhancedMat
            prevTimestampNs = currentTimestampNs
            val latency = (System.nanoTime() - startTime) / 1_000_000
            return emptyResult(EngineState.UNSTABLE_PLANE, currentFps, latency, W, H)
        }

        // Draw green flow vectors for safe anchor points
        for (i in anchorPrev.indices) {
            renderedVectors.add(
                FlowVector(
                    startX = anchorPrev[i].x.toFloat(),
                    startY = anchorPrev[i].y.toFloat(),
                    endX = anchorCurr[i].x.toFloat(),
                    endY = anchorCurr[i].y.toFloat(),
                    isAnomaly = false,
                    hazardType = HazardType.NONE,
                    residualMagnitude = 0f
                )
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

            // Project previous look-ahead points through ground homography
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
                    // Vertical residual sign:
                    // Faster downward flow than expected (residualY > 0) -> Elevated Obstacle
                    // Slower downward flow than expected (residualY < 0) -> Depression / Pothole
                    hazard = if (residualY > 0) {
                        bucketElevatedCounts[bucket] = bucketElevatedCounts.getValue(bucket) + 1
                        HazardType.ELEVATED
                    } else {
                        bucketDepressionCounts[bucket] = bucketDepressionCounts.getValue(bucket) + 1
                        HazardType.DEPRESSION
                    }
                }

                renderedVectors.add(
                    FlowVector(
                        startX = prevPt.x.toFloat(),
                        startY = prevPt.y.toFloat(),
                        endX = currPt.x.toFloat(),
                        endY = currPt.y.toFloat(),
                        isAnomaly = isAnomaly,
                        hazardType = hazard,
                        residualMagnitude = residualNorm
                    )
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

            // Must have at least 3 tracked points and >= 35% anomaly
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

    private fun emptyResult(
        state: EngineState,
        fps: Float,
        latencyMs: Long,
        width: Int,
        height: Int
    ): FrameAnalysisResult {
        val emptyAlerts = BucketId.values().associateWith {
            BucketAlert(it, isTriggered = false, dominantHazard = HazardType.NONE, anomalyRatio = 0f, totalPoints = 0)
        }
        return FrameAnalysisResult(
            state = state,
            fps = fps,
            latencyMs = latencyMs,
            validTrackCount = 0,
            inlierPercentage = 0f,
            medianFlowMag = 0f,
            vectors = emptyList(),
            alerts = emptyAlerts,
            frameWidth = width,
            frameHeight = height
        )
    }

    fun release() {
        prevGrayMat?.release()
        prevGrayMat = null
    }
}
