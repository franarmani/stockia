// src/components/music/MiniSpectrumCanvas.tsx
// Lightweight 120×24 spectrum bar canvas for the header mini player.

import { useEffect, useRef } from 'react'
import { getAnalysers, resumeAudioContext } from '@/lib/music/audioContext'

interface Props {
  audioRef: HTMLAudioElement | null
  isPlaying: boolean
  /** Width in px (default 120) */
  width?: number
  /** Height in px (default 24) */
  height?: number
  /** Bar colour (default green) */
  color?: string
}

export default function MiniSpectrumCanvas({
  audioRef,
  isPlaying,
  width = 120,
  height = 24,
  color = '#1DB954',
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef    = useRef<number>(0)
  const analyserRef = useRef<AnalyserNode | null>(null)

  useEffect(() => {
    if (!audioRef) return
    const onPlay = () => resumeAudioContext()
    audioRef.addEventListener('play', onPlay)
    return () => audioRef.removeEventListener('play', onPlay)
  }, [audioRef])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !audioRef) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Lazy init analyser on first play
    let analyser = analyserRef.current
    if (!analyser && isPlaying) {
      try {
        const [mini] = getAnalysers(audioRef)
        analyser = mini
        analyserRef.current = analyser
      } catch {
        // Cross-origin or policy block
      }
    }

    // DPR-aware sizing
    const dpr = window.devicePixelRatio || 1
    canvas.width = width * dpr
    canvas.height = height * dpr
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
    ctx.scale(dpr, dpr)

    const bufferLength = analyser ? analyser.frequencyBinCount : 64
    const dataArray = new Uint8Array(bufferLength)
    const BAR_COUNT = 28
    const BAR_GAP = 1.5

    function draw() {
      if (!ctx) return
      rafRef.current = requestAnimationFrame(draw)

      ctx.clearRect(0, 0, width, height)

      if (analyser && isPlaying) {
        analyser.getByteFrequencyData(dataArray)
      } else {
        // Idle animation: gentle sine wave
        const t = Date.now() / 1000
        for (let i = 0; i < bufferLength; i++) {
          dataArray[i] = isPlaying ? 0 : 10 + 8 * Math.sin(t * 2 + i * 0.5)
        }
      }

      const barW = (width - BAR_GAP * (BAR_COUNT - 1)) / BAR_COUNT
      const step = Math.floor(bufferLength / BAR_COUNT)

      for (let i = 0; i < BAR_COUNT; i++) {
        const value = dataArray[i * step] ?? 0
        const barH = Math.max(2, (value / 255) * height)
        const x = i * (barW + BAR_GAP)
        const y = height - barH

        // Gradient: bright at top, fade at bottom
        const grad = ctx.createLinearGradient(0, y, 0, height)
        grad.addColorStop(0, color)
        grad.addColorStop(1, color + '55')
        ctx.fillStyle = grad
        ctx.beginPath()
        ctx.roundRect(x, y, barW, barH, 1.5)
        ctx.fill()
      }
    }

    draw()

    return () => {
      cancelAnimationFrame(rafRef.current)
    }
  }, [audioRef, isPlaying, width, height, color])

  return (
    <canvas
      ref={canvasRef}
      style={{ imageRendering: 'pixelated' }}
      className="opacity-90"
    />
  )
}
