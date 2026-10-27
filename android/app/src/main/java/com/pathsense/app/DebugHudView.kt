package com.pathsense.app

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.DashPathEffect
import android.graphics.Paint
import android.graphics.RectF
import android.util.AttributeSet
import android.view.View

/**
 * Ultra-lightweight Custom Canvas View rendering:
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

    // Pre-allocated Paint objects to prevent runtime GC allocations
    private val anchorZonePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.argb(190, 74, 222, 128) // Neon Green
        style = Paint.Style.STROKE
        strokeWidth = 4f
    }

    private val lookAheadGridPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.argb(180, 56, 189, 248) // Cyan
        style = Paint.Style.STROKE
        strokeWidth = 3f
        pathEffect = DashPathEffect(floatArrayOf(14f, 10f), 0f)
    }

    private val inlierFlowPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.argb(220, 34, 197, 94) // Bright Emerald Green
        strokeWidth = 3f
        style = Paint.Style.STROKE
    }

    private val anomalyFlowPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.argb(255, 239, 68, 68) // Bright Crimson Red
        strokeWidth = 5f
        style = Paint.Style.STROKE
    }

    private val anomalyElevatedPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.argb(255, 245, 158, 11) // Vivid Amber for Raised Brick/Curb
        strokeWidth = 5f
        style = Paint.Style.STROKE
    }

    private val anomalyCirclePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.FILL
    }

    private val hudCardBackgroundPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.argb(210, 15, 23, 42) // Dark Slate
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
        color = Color.argb(220, 148, 163, 184) // Slate 400
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

        // 1. Draw Look-Ahead Zone (y: 30% to 70%) & 3 Horizontal Buckets (Left / Center / Right)
        val lookAheadTop = 0.30f * viewH
        val lookAheadBottom = 0.70f * viewH
        val oneThirdX = viewW / 3f
        val twoThirdX = 2f * viewW / 3f

        // Bucket boundaries
        canvas.drawLine(oneThirdX, lookAheadTop, oneThirdX, lookAheadBottom, lookAheadGridPaint)
        canvas.drawLine(twoThirdX, lookAheadTop, twoThirdX, lookAheadBottom, lookAheadGridPaint)
        canvas.drawLine(0f, lookAheadTop, viewW, lookAheadTop, lookAheadGridPaint)
        canvas.drawLine(0f, lookAheadBottom, viewW, lookAheadBottom, lookAheadGridPaint)

        // Bucket Labels
        labelPaint.color = Color.argb(160, 56, 189, 248)
        canvas.drawText("LOOK-AHEAD: LEFT", 30f, lookAheadTop + 36f, labelPaint)
        canvas.drawText("LOOK-AHEAD: CENTER", oneThirdX + 24f, lookAheadTop + 36f, labelPaint)
        canvas.drawText("LOOK-AHEAD: RIGHT", twoThirdX + 24f, lookAheadTop + 36f, labelPaint)

        // Highlight triggered buckets
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
                        Color.argb(80, 245, 158, 11) // Amber tint
                    } else {
                        Color.argb(90, 239, 68, 68) // Red tint
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

        // State indicator dot & title
        val stateColor = when (res.state) {
            EngineState.WALKING -> Color.rgb(34, 197, 94) // Green
            EngineState.HAZARD_ALERT -> Color.rgb(239, 68, 68) // Red
            EngineState.STATIONARY -> Color.rgb(234, 179, 8) // Yellow
            EngineState.LOW_TEXTURE_PAUSED -> Color.rgb(148, 163, 184) // Slate
            EngineState.UNSTABLE_PLANE -> Color.rgb(249, 115, 22) // Orange
        }

        val dotPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = stateColor
            style = Paint.Style.FILL
        }
        canvas.drawCircle(54f, 74f, 12f, dotPaint)

        hudTextPaint.color = stateColor
        canvas.drawText("STATE: ${res.state.name}", 80f, 84f, hudTextPaint)

        // Metrics row 1: FPS and Frame Latency
        hudTextPaint.color = Color.WHITE
        val fpsStr = String.format("%.1f FPS  |  %d ms/frame", res.fps, res.latencyMs)
        canvas.drawText(fpsStr, 48f, 142f, hudTextPaint)

        // Metrics row 2: Valid tracks, Inlier ratio, Median flow
        val tracksStr = String.format("Tracks: %d  |  Inliers: %.0f%%  |  Flow: %.1f px",
            res.validTrackCount, res.inlierPercentage, res.medianFlowMag)
        canvas.drawText(tracksStr, 48f, 196f, hudSubTextPaint)

        // Alerts row 3
        val triggered = res.alerts.values.filter { it.isTriggered }
        val alertsStr = if (triggered.isEmpty()) {
            "Hazard Status: PATH CLEAR"
        } else {
            "ALERTS: " + triggered.joinToString(", ") { "${it.bucket}:${it.dominantHazard}" }
        }
        hudSubTextPaint.color = if (triggered.isEmpty()) Color.argb(200, 74, 222, 128) else Color.rgb(239, 68, 68)
        canvas.drawText(alertsStr, 48f, 252f, hudSubTextPaint)
    }
}
