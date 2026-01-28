import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import type { Track } from '../lib/types'

interface PlayerState {
  currentTrack: Track | null
  isPlaying: boolean
  audioUrl: string | null
  artworkUrl: string | null
  play: (track: Track, url: string, artworkUrl?: string) => void
  pause: () => void
  resume: () => void
  stop: () => void
  setIsPlaying: (v: boolean) => void
}

const PlayerContext = createContext<PlayerState | undefined>(undefined)

export function PlayerProvider({ children }: { children: ReactNode }) {
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [artworkUrl, setArtworkUrl] = useState<string | null>(null)

  const play = useCallback((track: Track, url: string, artwork?: string) => {
    setCurrentTrack(track)
    setAudioUrl(url)
    setArtworkUrl(artwork || null)
    setIsPlaying(true)
  }, [])

  const pause = useCallback(() => {
    setIsPlaying(false)
  }, [])

  const resume = useCallback(() => {
    setIsPlaying(true)
  }, [])

  const stop = useCallback(() => {
    setCurrentTrack(null)
    setAudioUrl(null)
    setArtworkUrl(null)
    setIsPlaying(false)
  }, [])

  return (
    <PlayerContext.Provider value={{ currentTrack, isPlaying, audioUrl, artworkUrl, play, pause, resume, stop, setIsPlaying }}>
      {children}
    </PlayerContext.Provider>
  )
}

export function usePlayer() {
  const context = useContext(PlayerContext)
  if (!context) throw new Error('usePlayer must be used within PlayerProvider')
  return context
}
