'use client'

import React, { useEffect, useRef } from 'react'

import { FLOOR, GOAL, mapX, mapY, RIDGE_W, skylineAt } from '@/components/Ridge/Ridge'

/**
 * The cohort field — the Direction B hero motif. 20,000 points (one per
 * participant in the national cohort) drift in and settle into the Summit M
 * skyline from the brand mark; a small amber cluster forms the goal.
 *
 * Engineering notes:
 * - All positions live in typed arrays; each frame is written into an
 *   ImageData pixel buffer (no per-point draw calls), so a full frame costs
 *   ~1–2 ms even at 20,000 points.
 * - Point colours are pre-blended against the ink ground, so no alpha
 *   compositing is needed per pixel.
 * - The loop only runs while the canvas is on screen, the tab is visible and
 *   `html[data-motion="on"]`; otherwise a single settled frame is rendered.
 */

const N = 20000
const GOAL_SHARE = 0.035
const SETTLE_MS = 1600
const MAX_DPR = 2

/** Deterministic LCG so every visitor sees the same field. */
const makeRandom = (seed: number) => {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 4294967296
  }
}

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)

type Palette = {
  ink: [number, number, number]
  petrol: [number, number, number]
  amber: [number, number, number]
}

/** Pack an sRGB colour pre-blended over the ink ground into a little-endian ABGR word. */
const pack = (rgb: [number, number, number], alpha: number, ink: [number, number, number]) => {
  const r = Math.round(ink[0] + (rgb[0] - ink[0]) * alpha)
  const g = Math.round(ink[1] + (rgb[1] - ink[1]) * alpha)
  const b = Math.round(ink[2] + (rgb[2] - ink[2]) * alpha)
  return (255 << 24) | (b << 16) | (g << 8) | r
}

export const CohortField: React.FC<{ className?: string }> = ({ className }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d', { alpha: false })
    if (!ctx) return

    const random = makeRandom(20260821)

    // Sample the hero's actual ground colour so the canvas edge is seamless —
    // the browser parses the oklch token for us via canvas fillStyle.
    const sampleInk = (): [number, number, number] => {
      try {
        const probe = document.createElement('canvas')
        probe.width = probe.height = 1
        const pctx = probe.getContext('2d')
        const token = getComputedStyle(canvas).getPropertyValue('--brand-deep').trim()
        if (pctx && token) {
          pctx.fillStyle = token
          pctx.fillRect(0, 0, 1, 1)
          const d = pctx.getImageData(0, 0, 1, 1).data
          return [d[0], d[1], d[2]]
        }
      } catch {
        /* fall through to the static fallback */
      }
      return [1, 32, 39]
    }

    // Targets in the 800×600 design space of the ridge geometry
    const tx = new Float32Array(N)
    const ty = new Float32Array(N)
    const sx = new Float32Array(N)
    const sy = new Float32Array(N)
    const delay = new Float32Array(N)
    const phase = new Float32Array(N)
    const speed = new Float32Array(N)
    const colorWord = new Uint32Array(N)

    const palette: Palette = {
      ink: sampleInk(),
      petrol: [141, 197, 203],
      amber: [225, 154, 85],
    }

    const goalCount = Math.floor(N * GOAL_SHARE)
    const gx = mapX(GOAL[0])
    const gy = mapY(GOAL[1])

    for (let i = 0; i < N; i++) {
      if (i < goalCount) {
        // The goal: a dense amber disc above the summit
        const r = 14 * Math.sqrt(random())
        const a = random() * Math.PI * 2
        tx[i] = gx + r * Math.cos(a)
        ty[i] = gy + r * Math.sin(a) * 0.96
        colorWord[i] = pack(palette.amber, 0.55 + 0.45 * random(), palette.ink)
      } else {
        // The mountain body: denser (and brighter) toward the skyline
        const x = random() * RIDGE_W
        const ys = skylineAt(x)
        const depth = Math.pow(random(), 2.1)
        tx[i] = x
        ty[i] = ys + (FLOOR + 70 - ys) * depth
        const nearRidge = 1 - depth
        // ease the field in over the left 140 units so it never cuts off hard
        const edge = Math.min(1, x / 140)
        const alpha = (0.1 + 0.7 * nearRidge * nearRidge * (0.35 + 0.65 * random())) * edge * edge
        const amberFleck = random() < 0.012
        colorWord[i] = pack(amberFleck ? palette.amber : palette.petrol, alpha, palette.ink)
      }
      // Arrive from a loose cloud around the target, sweeping left to right
      sx[i] = tx[i] + (random() - 0.5) * 560
      sy[i] = ty[i] + (random() - 0.5) * 560
      delay[i] = (tx[i] / RIDGE_W) * 500 + random() * 500
      phase[i] = random() * Math.PI * 2
      speed[i] = 0.4 + random() * 0.8
    }

    let width = 0
    let height = 0
    let scale = 1
    let offsetY = 0
    let image: ImageData | null = null
    let pixels: Uint32Array | null = null
    let inkWord = 0

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) return
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR)
      width = Math.round(rect.width * dpr)
      height = Math.round(rect.height * dpr)
      canvas.width = width
      canvas.height = height
      scale = width / RIDGE_W
      // keep the floor anchored near the bottom of the canvas
      offsetY = height - FLOOR * scale - 40 * scale
      image = ctx.createImageData(width, height)
      pixels = new Uint32Array(image.data.buffer)
      inkWord = (255 << 24) | (palette.ink[2] << 16) | (palette.ink[1] << 8) | palette.ink[0]
    }

    let raf = 0
    let start = 0
    let running = false
    let settled = false

    const drawFrame = (now: number, animate: boolean) => {
      if (!image || !pixels) return
      pixels.fill(inkWord)
      const t = now - start
      const dot = Math.max(1, Math.round(scale * 1.6))
      let allSettled = true

      for (let i = 0; i < N; i++) {
        let x: number
        let y: number
        if (!animate) {
          x = tx[i]
          y = ty[i]
        } else {
          const progress = Math.min(1, Math.max(0, (t - delay[i]) / SETTLE_MS))
          if (progress < 1) allSettled = false
          const e = easeOutCubic(progress)
          x = sx[i] + (tx[i] - sx[i]) * e
          y = sy[i] + (ty[i] - sy[i]) * e
          if (progress >= 1) {
            // settled: a slow, almost imperceptible drift
            const w = now * 0.00045 * speed[i] + phase[i]
            x += Math.sin(w) * 1.4
            y += Math.cos(w * 0.9) * 1.2
          }
        }
        const px = (x * scale) | 0
        const py = (y * scale + offsetY) | 0
        if (px < 0 || py < 0 || px >= width - dot || py >= height - dot) continue
        const c = colorWord[i]
        for (let dy = 0; dy < dot; dy++) {
          const row = (py + dy) * width + px
          for (let dx = 0; dx < dot; dx++) pixels[row + dx] = c
        }
      }
      ctx.putImageData(image, 0, 0)
      if (animate && allSettled) settled = true
    }

    const motionOn = () => document.documentElement.getAttribute('data-motion') === 'on'

    const loop = (now: number) => {
      if (!running) return
      drawFrame(now, true)
      raf = requestAnimationFrame(loop)
    }

    const stop = () => {
      running = false
      cancelAnimationFrame(raf)
    }

    const renderStatic = () => {
      if (!image) resize()
      drawFrame(0, false)
    }

    let onScreen = true

    const startIfAppropriate = () => {
      if (running) return
      if (!motionOn() || document.hidden || !onScreen) {
        renderStatic()
        return
      }
      if (settled) {
        // came back after settling: keep the idle drift going
        running = true
        raf = requestAnimationFrame(loop)
        return
      }
      running = true
      start = performance.now()
      raf = requestAnimationFrame(loop)
    }

    resize()
    startIfAppropriate()

    const ro = new ResizeObserver(() => {
      resize()
      if (!running) renderStatic()
    })
    ro.observe(canvas)

    const io = new IntersectionObserver(
      (entries) => {
        onScreen = entries.some((e) => e.isIntersecting)
        if (!onScreen) stop()
        else startIfAppropriate()
      },
      { threshold: 0.05 },
    )
    io.observe(canvas)

    const onVisibility = () => {
      if (document.hidden) stop()
      else startIfAppropriate()
    }
    document.addEventListener('visibilitychange', onVisibility)

    const attrs = new MutationObserver(() => {
      if (!motionOn()) {
        stop()
        renderStatic()
      } else {
        startIfAppropriate()
      }
    })
    attrs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-motion'] })

    return () => {
      stop()
      ro.disconnect()
      io.disconnect()
      attrs.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  return <canvas aria-hidden="true" className={className} ref={canvasRef} />
}
