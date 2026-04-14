import { useEffect, useRef } from 'react'
import { useMusicStore } from '@/stores/useMusicStore'

declare global {
  interface Window {
    onYouTubeIframeAPIReady: () => void
    YT: any
  }
}

export default function YouTubePlayer() {
  const { 
    currentTrack, 
    isPlaying, 
    volume,
    playbackSource, 
    nextTrack,
    currentTime,
    duration
  } = useMusicStore()
  
  const playerRef = useRef<any>(null)
  const isReady = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // 1. Load the YouTube IFrame API script
    if (!window.YT) {
      const tag = document.createElement('script')
      tag.src = 'https://www.youtube.com/iframe_api'
      const firstScriptTag = document.getElementsByTagName('script')[0]
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag)

      window.onYouTubeIframeAPIReady = () => {
        initPlayer()
      }
    } else if (window.YT && window.YT.Player) {
      initPlayer()
    }

    return () => {
      if (playerRef.current) {
        playerRef.current.destroy()
        playerRef.current = null
        isReady.current = false
      }
    }
  }, [])

  const initPlayer = () => {
    if (playerRef.current) return

    playerRef.current = new window.YT.Player('yt-player-internal', {
      height: '0',
      width: '0',
      playerVars: {
        autoplay: 0,
        controls: 0,
        disablekb: 1,
        rel: 0,
        showinfo: 0,
        modestbranding: 1,
        origin: window.location.origin
      },
      events: {
        onReady: (event: any) => {
          isReady.current = true
          event.target.setVolume(volume * 100)
          // If already playing when ready, load the video
          if (playbackSource === 'youtube' && currentTrack?.youtube_id) {
             event.target.loadVideoById(currentTrack.youtube_id)
             if (!isPlaying) event.target.pauseVideo()
          }
        },
        onStateChange: (event: any) => {
          if (event.data === window.YT.PlayerState.ENDED) {
            nextTrack()
          }
        }
      }
    })
  }

  // Handle Play/Pause and Source changes
  useEffect(() => {
    if (!playerRef.current || !isReady.current || playbackSource !== 'youtube' || !currentTrack?.youtube_id) return

    const player = playerRef.current
    const currentVideoId = player.getVideoData?.()?.video_id

    if (currentVideoId !== currentTrack.youtube_id) {
      player.loadVideoById(currentTrack.youtube_id)
      if (!isPlaying) player.pauseVideo()
      return
    }

    if (isPlaying) {
      player.playVideo()
    } else {
      player.pauseVideo()
    }
  }, [isPlaying, currentTrack?.youtube_id, playbackSource])

  // Polish for current time and duration updates
  useEffect(() => {
    let interval: any
    if (isPlaying && isReady.current && playbackSource === 'youtube') {
      interval = setInterval(() => {
        if (playerRef.current && playerRef.current.getCurrentTime) {
          const time = playerRef.current.getCurrentTime()
          const dur = playerRef.current.getDuration()
          useMusicStore.setState({ currentTime: time, duration: dur })
        }
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [isPlaying, playbackSource])

  // Handle Seek Request from store
  useEffect(() => {
    // If the difference between store's currentTime and player's time is significant, seek
    if (playerRef.current && isReady.current && playbackSource === 'youtube') {
      const playerTime = playerRef.current.getCurrentTime()
      if (Math.abs(currentTime - playerTime) > 2) {
        playerRef.current.seekTo(currentTime, true)
      }
    }
  }, [currentTime])

  // Handle Volume
  useEffect(() => {
    if (playerRef.current && isReady.current && playbackSource === 'youtube') {
      playerRef.current.setVolume(volume * 100)
    }
  }, [volume, playbackSource])

  return (
    <div className="hidden pointer-events-none opacity-0 invisible" ref={containerRef}>
      <div id="yt-player-internal"></div>
    </div>
  )
}
