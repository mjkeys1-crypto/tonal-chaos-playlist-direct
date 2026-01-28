import { useEffect, useState } from 'react'
import { Plus, Play, Trash2, Music, Loader2 } from 'lucide-react'
import { listTracks, deleteTrack, getSignedUrl } from '../lib/api/tracks'
import { usePlayer } from '../context/PlayerContext'
import TrackUploader from '../components/tracks/TrackUploader'
import type { Track } from '../lib/types'

function formatDuration(seconds: number | null) {
  if (!seconds) return '--:--'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function formatSize(bytes: number | null) {
  if (!bytes) return ''
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export default function TracksPage() {
  const [tracks, setTracks] = useState<Track[]>([])
  const [loading, setLoading] = useState(true)
  const [showUploader, setShowUploader] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const { play, currentTrack, isPlaying, pause, resume } = usePlayer()

  const loadTracks = async () => {
    try {
      const data = await listTracks()
      setTracks(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadTracks() }, [])

  const handlePlay = async (track: Track) => {
    if (currentTrack?.id === track.id) {
      isPlaying ? pause() : resume()
      return
    }
    const path = track.storage_path || track.file_url
    if (!path) return
    const url = await getSignedUrl(path)
    play(track, url)
  }

  const handleDelete = async (track: Track) => {
    if (!confirm(`Delete "${track.title}"?`)) return
    setDeleting(track.id)
    try {
      await deleteTrack(track.id, track.storage_path || track.file_url)
      setTracks(prev => prev.filter(t => t.id !== track.id))
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Track Library</h1>
        <button
          onClick={() => setShowUploader(true)}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Plus size={16} />
          Upload
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin text-zinc-500" size={24} />
        </div>
      ) : tracks.length === 0 ? (
        <div className="text-center py-20">
          <Music className="mx-auto mb-3 text-zinc-600" size={48} />
          <p className="text-zinc-400">No tracks yet. Upload some audio files to get started.</p>
        </div>
      ) : (
        <div className="border border-zinc-800 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="text-left text-xs text-zinc-500 uppercase tracking-wider border-b border-zinc-800">
                <th className="px-4 py-3 w-10"></th>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3 hidden sm:table-cell">Format</th>
                <th className="px-4 py-3 hidden sm:table-cell">Size</th>
                <th className="px-4 py-3">Duration</th>
                <th className="px-4 py-3 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {tracks.map(track => (
                <tr
                  key={track.id}
                  className={`border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors ${
                    currentTrack?.id === track.id ? 'bg-zinc-800/50' : ''
                  }`}
                >
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handlePlay(track)}
                      className="text-zinc-400 hover:text-white transition-colors"
                    >
                      <Play size={16} fill={currentTrack?.id === track.id && isPlaying ? 'currentColor' : 'none'} />
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium truncate max-w-xs">{track.title}</p>
                    {track.artist && <p className="text-xs text-zinc-500">{track.artist}</p>}
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-500 uppercase hidden sm:table-cell">{track.format}</td>
                  <td className="px-4 py-3 text-xs text-zinc-500 hidden sm:table-cell">{formatSize(track.file_size)}</td>
                  <td className="px-4 py-3 text-sm text-zinc-400 tabular-nums">{formatDuration(track.duration)}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleDelete(track)}
                      disabled={deleting === track.id}
                      className="text-zinc-500 hover:text-red-400 transition-colors disabled:opacity-50"
                    >
                      {deleting === track.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showUploader && (
        <TrackUploader
          onComplete={loadTracks}
          onClose={() => setShowUploader(false)}
        />
      )}
    </div>
  )
}
