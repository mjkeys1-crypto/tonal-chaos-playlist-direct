import { useEffect, useState, useRef, useCallback } from 'react'
import { Play, Pause, X, Music } from 'lucide-react'
import WaveSurfer from 'wavesurfer.js'
import { usePlayer } from '../../context/PlayerContext'

function formatTime(s: number) {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

export default function PlayerBar() {
  const { currentTrack, isPlaying, audioUrl, artworkUrl, pause, resume, stop } = usePlayer()
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const waveContainerRef = useRef<HTMLDivElement | null>(null)
  const wsRef = useRef<WaveSurfer | null>(null)
  const loadedUrlRef = useRef<string | null>(null)

  // Sync play/pause state to WaveSurfer
  useEffect(() => {
    const ws = wsRef.current
    if (!ws) return
    if (isPlaying && !ws.isPlaying()) {
      ws.play().catch(() => {})
    } else if (!isPlaying && ws.isPlaying()) {
      ws.pause()
    }
  }, [isPlaying])

  const initWaveSurfer = useCallback(() => {
    if (!audioUrl || !waveContainerRef.current) return
    if (audioUrl === loadedUrlRef.current) return
    loadedUrlRef.current = audioUrl

    // Destroy previous
    if (wsRef.current) {
      wsRef.current.destroy()
      wsRef.current = null
    }

    const ws = WaveSurfer.create({
      container: waveContainerRef.current,
      url: audioUrl,
      waveColor: '#52525b',
      progressColor: '#6366f1',
      cursorColor: '#a5b4fc',
      cursorWidth: 1,
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      height: 40,
      normalize: true,
      interact: true,
    })

    wsRef.current = ws

    ws.on('ready', () => {
      setDuration(ws.getDuration())
      ws.play().catch(() => {})
    })

    ws.on('timeupdate', (t: number) => setCurrentTime(t))

    ws.on('finish', () => {
      stop()
    })
  }, [audioUrl, stop])

  // When audioUrl changes and container is already mounted
  useEffect(() => {
    initWaveSurfer()
  }, [initWaveSurfer])

  // Callback ref for first mount
  const setWaveContainer = useCallback((node: HTMLDivElement | null) => {
    waveContainerRef.current = node
    if (node) initWaveSurfer()
  }, [initWaveSurfer])

  // Cleanup
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.destroy()
        wsRef.current = null
      }
    }
  }, [])

  if (!currentTrack) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-zinc-900 border-t border-zinc-800 z-40">
      <div className="flex items-center gap-4 px-4 py-3">
        {/* Thumbnail */}
        <div className="w-12 h-12 rounded bg-zinc-800 flex items-center justify-center shrink-0 overflow-hidden">
          {artworkUrl ? (
            <img src={artworkUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <Music size={20} className="text-zinc-600" />
          )}
        </div>

        <button
          onClick={() => isPlaying ? pause() : resume()}
          className="text-white hover:text-indigo-400 transition-colors shrink-0"
        >
          {isPlaying ? <Pause size={20} /> : <Play size={20} />}
        </button>

        <div className="shrink-0 min-w-0 max-w-[200px]">
          <p className="text-sm font-medium truncate">{currentTrack.title}</p>
          {currentTrack.artist && (
            <p className="text-xs text-zinc-400 truncate">{currentTrack.artist}</p>
          )}
        </div>

        <div ref={setWaveContainer} className="flex-1 min-w-0" />

        <span className="text-xs text-zinc-400 tabular-nums shrink-0">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>

        <button onClick={stop} className="text-zinc-500 hover:text-white transition-colors shrink-0">
          <X size={18} />
        </button>
      </div>
    </div>
  )
}
