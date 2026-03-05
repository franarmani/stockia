// src/components/music/BigSpectrumCanvas.tsx
// Full-width premium spectrum visualiser for the /music page.
// Uses fftSize=1024 for high-detail rendering.

import { useEffect, useRef } from 'react'
import { getAnalysers, resumeAudioContext } from '@/lib/music/audioContext'

interface Props {
  audioRef: HTMLAudioElement | null
  isPlaying: boolean
  className?: string
  /** Bar count (default 80) */
  bars?: number
  /** Primary colour stop */
  colorFrom?: string
  /** Secondary colour stop */
  colorTo?: string
}

export default function BigSpectrumCanvas({
  audioRef,
  isPlaying,
  className = '',
  bars = 80,
  colorFrom = '#1DB954',
  colorTo = '#00D4FF',
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef    = useRef<number>(0)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!audioRef) return
    const onPlay = () => resumeAudioContext()
    audioRef.addEventListener('play', onPlay)
    return () => audioRef.removeEventListener('play', onPlay)
  }, [audioRef])

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container || !audioRef) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Lazy init on first play
    let analyser = analyserRef.current
    if (!analyser && isPlaying) {
      try {
        const [, big] = getAnalysers(audioRef)
        analyser = big
        analyserRef.current = analyser
      } catch {
        // Silently skip
      }
    }

    const dpr = window.devicePixelRatio || 1

    function resize() {
      if (!canvas || !container || !ctx) return
      const w = container.clientWidth
      const h = container.clientHeight
      canvas.width = w * dpr
      canvas.height = h * dpr
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
      ctx.scale(dpr, dpr)
    }
    resize()

    const ro = new ResizeObserver(resize)
    ro.observe(container)

    const bufferLength = analyser ? analyser.frequencyBinCount : 256
    const dataArray = new Uint8Array(bufferLength)
    const BAR_GAP = 2

    function draw() {
      if (!ctx || !canvas) return
      rafRef.current = requestAnimationFrame(draw)

      const W = canvas.width / dpr
      const H = canvas.height / dpr
      ctx.clearRect(0, 0, W, H)

      if (analyser && isPlaying) {
        analyser.getByteFrequencyData(dataArray)
      } else {
        const t = Date.now() / 1200
        for (let i = 0; i < bufferLength; i++) {
          dataArray[i] = isPlaying ? 0 : 6 + 6 * Math.sin(t + i * 0.3)
        }
      }

      const barW = (W - BAR_GAP * (bars - 1)) / bars
      const step = Math.floor(bufferLength / bars)

      for (let i = 0; i < bars; i++) {
        const value = dataArray[i * step] ?? 0
        const barH = Math.max(3, (value / 255) * (H * 0.92))
        const x = i * (barW + BAR_GAP)
        const y = H - barH

        // Gradient per bar — green → cyan
        const grad = ctx.createLinearGradient(0, y, 0, H)
        grad.addColorStop(0, colorFrom)
        grad.addColorStop(0.6, colorTo)
        grad.addColorStop(1, colorTo + '33')
        ctx.fillStyle = grad

        // Rounded top caps
        ctx.beginPath()
        ctx.roundRect(x, y, Math.max(1, barW - 0.5), barH, [3, 3, 1, 1])
        ctx.fill()

        // Peak dot
        if (value > 20) {
          ctx.fillStyle = colorFrom + 'cc'
          ctx.fillRect(x, y - 3, Math.max(1, barW - 0.5), 2)
        }
      }

      // Mirror reflection (subtle)
      ctx.save()
      ctx.globalAlpha = 0.15
      ctx.scale(1, -1)
      ctx.translate(0, -H * 2)
      for (let i = 0; i < bars; i++) {
        const value = dataArray[i * step] ?? 0
        const barH = Math.max(3, (value / 255) * (H * 0.92)) * 0.3
        const x = i * (barW + BAR_GAP)
        const y = H - barH
        ctx.fillStyle = colorFrom + '44'
        ctx.fillRect(x, y, Math.max(1, barW - 0.5), barH)
      }
      ctx.restore()
    }

    draw()

    return () => {
      cancelAnimationFrame(rafRef.current)
      ro.disconnect()
    }
  }, [audioRef, isPlaying, bars, colorFrom, colorTo])

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      <canvas ref={canvasRef} className="w-full h-full" />
    </div>
  )
}
