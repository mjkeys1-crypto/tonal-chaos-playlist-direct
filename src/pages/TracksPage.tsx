import { useEffect, useState } from 'react'
import { Plus, Play, Trash2, Music, Loader2, ListPlus, Check } from 'lucide-react'
import { listTracks, deleteTrack, getSignedUrl } from '../lib/api/tracks'
import { listPlaylists, listSections, addTracksToPlaylist } from '../lib/api/playlists'
import { usePlayer } from '../context/PlayerContext'
import TrackUploader from '../components/tracks/TrackUploader'
import type { Track, Playlist, Section } from '../lib/types'

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

  // Multi-select state
  const [selected, setSelected] = useState<Set<string>>(new Set())

  // Add to playlist modal
  const [showAddToPlaylist, setShowAddToPlaylist] = useState(false)
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [sections, setSections] = useState<Section[]>([])
  const [selectedPlaylist, setSelectedPlaylist] = useState<string | null>(null)
  const [selectedSection, setSelectedSection] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

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
      setSelected(prev => { const next = new Set(prev); next.delete(track.id); return next })
    } finally {
      setDeleting(null)
    }
  }

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selected.size === tracks.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(tracks.map(t => t.id)))
    }
  }

  const openAddToPlaylist = async () => {
    setShowAddToPlaylist(true)
    const pls = await listPlaylists()
    setPlaylists(pls)
    setSelectedPlaylist(null)
    setSelectedSection(null)
    setSections([])
  }

  const handlePickPlaylist = async (plId: string) => {
    setSelectedPlaylist(plId)
    setSelectedSection(null)
    const secs = await listSections(plId)
    setSections(secs)
  }

  const handleAddToPlaylist = async () => {
    if (!selectedPlaylist || selected.size === 0) return
    setAdding(true)
    try {
      await addTracksToPlaylist(selectedPlaylist, Array.from(selected), selectedSection)
      setShowAddToPlaylist(false)
      setSelected(new Set())
    } finally {
      setAdding(false)
    }
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Track Library</h1>
        <div className="flex gap-2">
          {selected.size > 0 && (
            <button
              onClick={openAddToPlaylist}
              className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              <ListPlus size={16} />
              Add {selected.size} to Playlist
            </button>
          )}
          <button
            onClick={() => setShowUploader(true)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <Plus size={16} />
            Upload
          </button>
        </div>
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
                <th className="px-4 py-3 w-10">
                  <button onClick={toggleSelectAll} className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                    selected.size === tracks.length && tracks.length > 0
                      ? 'bg-indigo-600 border-indigo-600'
                      : 'border-zinc-600 hover:border-zinc-400'
                  }`}>
                    {selected.size === tracks.length && tracks.length > 0 && <Check size={10} className="text-white" />}
                  </button>
                </th>
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
                  } ${selected.has(track.id) ? 'bg-indigo-500/10' : ''}`}
                >
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleSelect(track.id)}
                      className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                        selected.has(track.id)
                          ? 'bg-indigo-600 border-indigo-600'
                          : 'border-zinc-600 hover:border-zinc-400'
                      }`}
                    >
                      {selected.has(track.id) && <Check size={10} className="text-white" />}
                    </button>
                  </td>
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

      {/* Add to Playlist modal */}
      {showAddToPlaylist && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-sm flex flex-col max-h-[70vh]">
            <div className="flex items-center justify-between p-4 border-b border-zinc-800">
              <h2 className="font-semibold">Add {selected.size} track{selected.size > 1 ? 's' : ''} to Playlist</h2>
              <button onClick={() => setShowAddToPlaylist(false)} className="text-zinc-400 hover:text-white text-sm">Close</button>
            </div>
            <div className="flex-1 overflow-auto p-2">
              {playlists.length === 0 ? (
                <p className="text-sm text-zinc-500 p-4 text-center">No playlists. Create one first.</p>
              ) : (
                <>
                  <p className="text-xs text-zinc-500 px-3 py-2 uppercase tracking-wider">Select playlist</p>
                  {playlists.map(pl => (
                    <button
                      key={pl.id}
                      onClick={() => handlePickPlaylist(pl.id)}
                      className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors ${
                        selectedPlaylist === pl.id ? 'bg-indigo-600/20 text-indigo-300' : 'hover:bg-zinc-800'
                      }`}
                    >
                      {pl.title}
                      {pl.client_name && <span className="text-zinc-500 ml-2">({pl.client_name})</span>}
                    </button>
                  ))}

                  {selectedPlaylist && sections.length > 0 && (
                    <>
                      <p className="text-xs text-zinc-500 px-3 py-2 mt-3 uppercase tracking-wider">Select section (optional)</p>
                      <button
                        onClick={() => setSelectedSection(null)}
                        className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors ${
                          selectedSection === null ? 'bg-indigo-600/20 text-indigo-300' : 'hover:bg-zinc-800'
                        }`}
                      >
                        Unsectioned
                      </button>
                      {sections.map(sec => (
                        <button
                          key={sec.id}
                          onClick={() => setSelectedSection(sec.id)}
                          className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors ${
                            selectedSection === sec.id ? 'bg-indigo-600/20 text-indigo-300' : 'hover:bg-zinc-800'
                          }`}
                        >
                          {sec.emoji && <span className="mr-2">{sec.emoji}</span>}
                          {sec.title}
                        </button>
                      ))}
                    </>
                  )}
                </>
              )}
            </div>
            {selectedPlaylist && (
              <div className="p-4 border-t border-zinc-800">
                <button
                  onClick={handleAddToPlaylist}
                  disabled={adding}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg transition-colors text-sm"
                >
                  {adding ? 'Adding...' : `Add to Playlist`}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
