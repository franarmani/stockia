// src/lib/music/audioContext.ts
// Singleton Web Audio context shared by all spectrum visualisers.
// One AudioContext + MediaElementAudioSourceNode per audio element.

let ctx: AudioContext | null = null
let source: MediaElementAudioSourceNode | null = null
let sourceEl: HTMLAudioElement | null = null
let miniAnalyser: AnalyserNode | null = null
let bigAnalyser: AnalyserNode | null = null

export function getAudioContext(): AudioContext {
  if (!ctx || ctx.state === 'closed') {
    ctx = new AudioContext()
  }
  return ctx
}

export function resumeAudioContext(): void {
  if (ctx && ctx.state === 'suspended') {
    ctx.resume().catch(() => {})
  }
}

/** Returns [miniAnalyser, bigAnalyser] wired from the audio element. */
export function getAnalysers(audio: HTMLAudioElement): [AnalyserNode, AnalyserNode] {
  const audioCtx = getAudioContext()

  // (Re-)create source if audio element changed
  if (!source || sourceEl !== audio) {
    if (source) {
      try { source.disconnect() } catch {}
    }
    source = audioCtx.createMediaElementSource(audio)
    sourceEl = audio
    miniAnalyser = null
    bigAnalyser = null
  }

  if (!miniAnalyser) {
    miniAnalyser = audioCtx.createAnalyser()
    miniAnalyser.fftSize = 256
    miniAnalyser.smoothingTimeConstant = 0.75
    source.connect(miniAnalyser)
    miniAnalyser.connect(audioCtx.destination)
  }

  if (!bigAnalyser) {
    bigAnalyser = audioCtx.createAnalyser()
    bigAnalyser.fftSize = 1024
    bigAnalyser.smoothingTimeConstant = 0.80
    // Tap from source directly (fan-out supported by Web Audio API)
    source.connect(bigAnalyser)
    // bigAnalyser does NOT connect to destination to avoid double playback
  }

  return [miniAnalyser, bigAnalyser]
}

export function getMiniAnalyser(): AnalyserNode | null { return miniAnalyser }
export function getBigAnalyser(): AnalyserNode | null { return bigAnalyser }
