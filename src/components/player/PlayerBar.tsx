import { useEffect, useState, useRef } from 'react'
import { Play, Pause, X } from 'lucide-react'
import { usePlayer } from '../../context/PlayerContext'

function formatTime(s: number) {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

export default function PlayerBar() {
  const { currentTrack, isPlaying, audioUrl, audioRef, pause, resume, stop } = usePlayer()
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const progressRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const onTime = () => setCurrentTime(audio.currentTime)
    const onDur = () => setDuration(audio.duration || 0)
    const onEnd = () => stop()

    audio.addEventListener('timeupdate', onTime)
    audio.addEventListener('loadedmetadata', onDur)
    audio.addEventListener('ended', onEnd)
    return () => {
      audio.removeEventListener('timeupdate', onTime)
      audio.removeEventListener('loadedmetadata', onDur)
      audio.removeEventListener('ended', onEnd)
    }
  }, [audioRef, stop])

  // Auto-play when audioUrl changes
  useEffect(() => {
    if (audioUrl && audioRef.current) {
      audioRef.current.src = audioUrl
      audioRef.current.play()
    }
  }, [audioUrl, audioRef])

  const seek = (e: React.MouseEvent) => {
    if (!progressRef.current || !audioRef.current || !duration) return
    const rect = progressRef.current.getBoundingClientRect()
    const pct = (e.clientX - rect.left) / rect.width
    audioRef.current.currentTime = pct * duration
  }

  if (!currentTrack) return <audio ref={audioRef} />

  const pct = duration ? (currentTime / duration) * 100 : 0

  return (
    <>
      <audio ref={audioRef} />
      <div className="fixed bottom-0 left-0 right-0 bg-zinc-900 border-t border-zinc-800 z-40">
        {/* Progress bar */}
        <div
          ref={progressRef}
          onClick={seek}
          className="h-1 bg-zinc-800 cursor-pointer group"
        >
          <div
            className="h-full bg-indigo-500 transition-[width] duration-200"
            style={{ width: `${pct}%` }}
          />
        </div>

        <div className="flex items-center gap-4 px-4 py-3">
          {/* Play/Pause */}
          <button
            onClick={isPlaying ? pause : resume}
            className="text-white hover:text-indigo-400 transition-colors"
          >
            {isPlaying ? <Pause size={20} /> : <Play size={20} />}
          </button>

          {/* Track info */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{currentTrack.title}</p>
            {currentTrack.artist && (
              <p className="text-xs text-zinc-400 truncate">{currentTrack.artist}</p>
            )}
          </div>

          {/* Time */}
          <span className="text-xs text-zinc-400 tabular-nums">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>

          {/* Close */}
          <button onClick={stop} className="text-zinc-500 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>
      </div>
    </>
  )
}
