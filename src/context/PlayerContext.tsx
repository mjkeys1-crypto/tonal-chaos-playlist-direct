import { createContext, useContext, useState, useRef, useCallback, type ReactNode } from 'react'
import type { Track } from '../lib/types'

interface PlayerState {
  currentTrack: Track | null
  isPlaying: boolean
  audioUrl: string | null
  audioRef: React.RefObject<HTMLAudioElement | null>
  play: (track: Track, url: string) => void
  pause: () => void
  resume: () => void
  stop: () => void
}

const PlayerContext = createContext<PlayerState | undefined>(undefined)

export function PlayerProvider({ children }: { children: ReactNode }) {
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const play = useCallback((track: Track, url: string) => {
    setCurrentTrack(track)
    setAudioUrl(url)
    setIsPlaying(true)
    // Audio element will auto-play via useEffect in PlayerBar
  }, [])

  const pause = useCallback(() => {
    audioRef.current?.pause()
    setIsPlaying(false)
  }, [])

  const resume = useCallback(() => {
    audioRef.current?.play()
    setIsPlaying(true)
  }, [])

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
    }
    setCurrentTrack(null)
    setAudioUrl(null)
    setIsPlaying(false)
  }, [])

  return (
    <PlayerContext.Provider value={{ currentTrack, isPlaying, audioUrl, audioRef, play, pause, resume, stop }}>
      {children}
    </PlayerContext.Provider>
  )
}

export function usePlayer() {
  const context = useContext(PlayerContext)
  if (!context) throw new Error('usePlayer must be used within PlayerProvider')
  return context
}
