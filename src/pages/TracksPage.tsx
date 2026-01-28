import { useEffect, useState, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Play, Pause, Trash2, Music, Loader2, ListPlus, Check, ListMusic, Share2, Download, Upload, Search, Filter, Info, X } from 'lucide-react'
import { listTracks, deleteTrack, getSignedUrl, getTrackArtworkUrl } from '../lib/api/tracks'
import { listPlaylists, listSections, addTracksToPlaylist, createPlaylist, getPlaylistsContainingTracks } from '../lib/api/playlists'
import { getOverviewStats } from '../lib/api/analytics'
import { usePlayer } from '../context/PlayerContext'
import { useAuth } from '../context/AuthContext'
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
  const navigate = useNavigate()
  const [tracks, setTracks] = useState<Track[]>([])
  const [loading, setLoading] = useState(true)
  const [showUploader, setShowUploader] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const { play, currentTrack, isPlaying, pause, resume } = usePlayer()
  const { user } = useAuth()
  const [stats, setStats] = useState({ tracks: 0, playlists: 0, activeShares: 0, totalPlays: 0, totalDownloads: 0 })
  const [artworkUrls, setArtworkUrls] = useState<Record<string, string>>({})

  // Multi-select state
  const [selected, setSelected] = useState<Set<string>>(new Set())

  // Search and filter
  const [searchQuery, setSearchQuery] = useState('')
  const [formatFilter, setFormatFilter] = useState<string>('all')

  const formats = useMemo(() => {
    const fmts = new Set(tracks.map(t => t.format).filter(Boolean))
    return Array.from(fmts).sort()
  }, [tracks])

  const filteredTracks = useMemo(() => {
    return tracks.filter(track => {
      const matchesSearch = !searchQuery ||
        track.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (track.artist && track.artist.toLowerCase().includes(searchQuery.toLowerCase()))
      const matchesFormat = formatFilter === 'all' || track.format === formatFilter
      return matchesSearch && matchesFormat
    })
  }, [tracks, searchQuery, formatFilter])

  // Page-level drag-and-drop
  const [pageDragging, setPageDragging] = useState(false)
  const [droppedFiles, setDroppedFiles] = useState<File[]>([])
  const dragCounterRef = { current: 0 }

  const handlePageDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    dragCounterRef.current++
    if (e.dataTransfer.types.includes('Files')) {
      setPageDragging(true)
    }
  }, [])

  const handlePageDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    dragCounterRef.current--
    if (dragCounterRef.current === 0) {
      setPageDragging(false)
    }
  }, [])

  const handlePageDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
  }, [])

  const handlePageDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    dragCounterRef.current = 0
    setPageDragging(false)

    const files = Array.from(e.dataTransfer.files).filter(f =>
      f.type.startsWith('audio/') || /\.(wav|mp3|aiff|flac|m4a|ogg)$/i.test(f.name)
    )
    if (files.length > 0) {
      setDroppedFiles(files)
      setShowUploader(true)
    }
  }, [])

  // Add to playlist modal
  const [showAddToPlaylist, setShowAddToPlaylist] = useState(false)
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [sections, setSections] = useState<Section[]>([])
  const [selectedPlaylist, setSelectedPlaylist] = useState<string | null>(null)
  const [selectedSection, setSelectedSection] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [showCreateNew, setShowCreateNew] = useState(false)
  const [newPlaylistTitle, setNewPlaylistTitle] = useState('')
  const [infoTrack, setInfoTrack] = useState<Track | null>(null)

  const loadTracks = async () => {
    try {
      const data = await listTracks()
      setTracks(data)

      // Load artwork URLs for tracks that have embedded artwork
      const artworkMap: Record<string, string> = {}
      await Promise.all(
        data.filter(t => t.artwork_path).map(async (t) => {
          try {
            artworkMap[t.id] = await getTrackArtworkUrl(t.artwork_path!)
          } catch {}
        })
      )
      setArtworkUrls(artworkMap)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadTracks(); getOverviewStats().then(setStats) }, [])

  const handlePlay = async (track: Track) => {
    if (currentTrack?.id === track.id) {
      isPlaying ? pause() : resume()
      return
    }
    const path = track.storage_path || track.file_url
    if (!path) return
    const url = await getSignedUrl(path)
    play(track, url, artworkUrls[track.id])
  }

  const handleDelete = async (track: Track) => {
    // Check if track is in any playlists
    const playlistRefs = await getPlaylistsContainingTracks([track.id])
    let message = `Delete "${track.title}"?`
    if (playlistRefs.length > 0) {
      const playlistNames = [...new Set(playlistRefs.map(p => p.playlistTitle))].join(', ')
      message = `"${track.title}" is in the following playlist(s):\n\n${playlistNames}\n\nAre you sure you want to delete it? This will remove it from these playlists.`
    }
    if (!confirm(message)) return

    setDeleting(track.id)
    try {
      await deleteTrack(track.id, track.storage_path || track.file_url, track.artwork_path)
      setTracks(prev => prev.filter(t => t.id !== track.id))
      setSelected(prev => { const next = new Set(prev); next.delete(track.id); return next })
      getOverviewStats().then(setStats)
    } catch (err: any) {
      console.error('Delete failed:', err)
      alert(`Could not delete track: ${err.message}\n\nCheck Supabase RLS policies.`)
      // Reload to see actual state
      const data = await listTracks()
      setTracks(data)
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
    const filteredIds = filteredTracks.map(t => t.id)
    const allFilteredSelected = filteredIds.every(id => selected.has(id))
    if (allFilteredSelected && filteredIds.length > 0) {
      setSelected(new Set())
    } else {
      setSelected(new Set(filteredIds))
    }
  }

  const openAddToPlaylist = async () => {
    setShowAddToPlaylist(true)
    const pls = await listPlaylists()
    setPlaylists(pls)
    setSelectedPlaylist(null)
    setSelectedSection(null)
    setSections([])
    setShowCreateNew(false)
    setNewPlaylistTitle('')
  }

  const handlePickPlaylist = async (plId: string) => {
    setSelectedPlaylist(plId)
    setSelectedSection(null)
    const secs = await listSections(plId)
    setSections(secs)
  }

  const handleBulkDelete = async () => {
    if (selected.size === 0) return

    // Check if any tracks are in playlists
    const playlistRefs = await getPlaylistsContainingTracks(Array.from(selected))
    let message = `Delete ${selected.size} track${selected.size > 1 ? 's' : ''}? This cannot be undone.`
    if (playlistRefs.length > 0) {
      const playlistNames = [...new Set(playlistRefs.map(p => p.playlistTitle))].join(', ')
      message = `${playlistRefs.length} of these tracks are in playlist(s):\n\n${playlistNames}\n\nAre you sure you want to delete them? They will be removed from these playlists.`
    }
    if (!confirm(message)) return

    const toDelete = tracks.filter(t => selected.has(t.id))
    const errors: string[] = []
    for (const track of toDelete) {
      try {
        await deleteTrack(track.id, track.storage_path || track.file_url, track.artwork_path)
      } catch (err: any) {
        console.error('Delete failed for track:', track.title, err)
        errors.push(`${track.title}: ${err.message}`)
      }
    }

    if (errors.length > 0) {
      alert(`Some tracks could not be deleted:\n\n${errors.join('\n')}\n\nCheck Supabase RLS policies for the 'tracks' and 'playlist_tracks' tables.`)
    }

    // Reload tracks to see actual state
    const data = await listTracks()
    setTracks(data)
    setSelected(new Set())
    getOverviewStats().then(setStats)
  }

  const handleAddToPlaylist = async () => {
    if (!selectedPlaylist || selected.size === 0) return
    setAdding(true)
    try {
      await addTracksToPlaylist(selectedPlaylist, Array.from(selected), selectedSection)
      setShowAddToPlaylist(false)
      setSelected(new Set())
      getOverviewStats().then(setStats)
    } finally {
      setAdding(false)
    }
  }

  const handleCreateAndAdd = async () => {
    if (!newPlaylistTitle.trim() || selected.size === 0 || !user) return
    setAdding(true)
    try {
      const newPlaylist = await createPlaylist(newPlaylistTitle.trim(), null, null, user.id)
      await addTracksToPlaylist(newPlaylist.id, Array.from(selected), null)
      setShowAddToPlaylist(false)
      setSelected(new Set())
      getOverviewStats().then(setStats)
    } finally {
      setAdding(false)
    }
  }

  const handleUploaderClose = useCallback(() => {
    setShowUploader(false)
    setDroppedFiles([])
  }, [])

  return (
    <div
      className="p-8 relative min-h-full"
      onDragEnter={handlePageDragEnter}
      onDragLeave={handlePageDragLeave}
      onDragOver={handlePageDragOver}
      onDrop={handlePageDrop}
    >
      {/* Page-level drop overlay */}
      {pageDragging && (
        <div className="absolute inset-0 z-40 bg-zinc-900/90 border-2 border-dashed border-indigo-500 rounded-xl flex flex-col items-center justify-center pointer-events-none">
          <Upload className="text-indigo-400 mb-4" size={64} />
          <p className="text-xl font-semibold text-white">Drop audio files to upload</p>
          <p className="text-sm text-zinc-400 mt-2">MP3, AIFF, FLAC, M4A, WAV</p>
          <p className="text-sm text-amber-400 mt-1 font-medium">MP3 & AIFF recommended — metadata is preserved</p>
        </div>
      )}

      {/* Stats Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        {[
          { label: 'Tracks', value: stats.tracks, icon: Music, color: 'text-blue-400' },
          { label: 'Playlists', value: stats.playlists, icon: ListMusic, color: 'text-purple-400', link: '/playlists' },
          { label: 'Active Shares', value: stats.activeShares, icon: Share2, color: 'text-green-400' },
          { label: 'Total Plays', value: stats.totalPlays, icon: Play, color: 'text-amber-400' },
          { label: 'Downloads', value: stats.totalDownloads, icon: Download, color: 'text-indigo-400' },
        ].map(({ label, value, icon: Icon, color, link }) => (
          <div
            key={label}
            onClick={link ? () => navigate(link) : undefined}
            className={`bg-zinc-900 border border-zinc-800 rounded-lg p-5 ${link ? 'cursor-pointer hover:bg-zinc-800/70 hover:border-zinc-700 transition-colors' : ''}`}
          >
            <Icon size={20} className={`${color} mb-3`} />
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-sm text-zinc-500 mt-1">{label}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Track Library</h1>
        <div className="flex gap-2">
          {selected.size > 0 && (
            <>
              <button
                onClick={handleBulkDelete}
                className="flex items-center gap-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
              >
                <Trash2 size={16} />
                Delete {selected.size}
              </button>
              <button
                onClick={openAddToPlaylist}
                className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
              >
                <ListPlus size={16} />
                Add {selected.size} to Playlist
              </button>
            </>
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

      {/* Search and Filter */}
      <div className="flex items-center gap-3 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
          <input
            type="text"
            placeholder="Search tracks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm placeholder-zinc-500 focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
          <select
            value={formatFilter}
            onChange={(e) => setFormatFilter(e.target.value)}
            className="pl-9 pr-8 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm appearance-none cursor-pointer focus:outline-none focus:border-indigo-500 transition-colors"
          >
            <option value="all">All Formats</option>
            {formats.map(fmt => (
              <option key={fmt || 'unknown'} value={fmt || ''}>{(fmt || 'Unknown').toUpperCase()}</option>
            ))}
          </select>
        </div>
        {(searchQuery || formatFilter !== 'all') && (
          <button
            onClick={() => { setSearchQuery(''); setFormatFilter('all') }}
            className="text-xs text-zinc-400 hover:text-white transition-colors"
          >
            Clear filters
          </button>
        )}
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
      ) : filteredTracks.length === 0 ? (
        <div className="text-center py-20">
          <Search className="mx-auto mb-3 text-zinc-600" size={48} />
          <p className="text-zinc-400">No tracks match your search.</p>
          <button
            onClick={() => { setSearchQuery(''); setFormatFilter('all') }}
            className="mt-3 text-sm text-indigo-400 hover:text-indigo-300"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="border border-zinc-800 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="text-left text-xs text-zinc-500 uppercase tracking-wider border-b border-zinc-800">
                <th className="px-4 py-3 w-10">
                  <button onClick={toggleSelectAll} className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                    selected.size === filteredTracks.length && filteredTracks.length > 0
                      ? 'bg-indigo-600 border-indigo-600'
                      : 'border-zinc-600 hover:border-zinc-400'
                  }`}>
                    {selected.size === filteredTracks.length && filteredTracks.length > 0 && <Check size={10} className="text-white" />}
                  </button>
                </th>
                <th className="px-4 py-3 w-14 text-center">Play</th>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3 hidden sm:table-cell">Format</th>
                <th className="px-4 py-3 hidden sm:table-cell">Size</th>
                <th className="px-4 py-3">Duration</th>
                <th className="px-4 py-3 w-10 text-center">Info</th>
                <th className="px-4 py-3 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {filteredTracks.map(track => (
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
                      className="relative w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center group overflow-hidden border border-zinc-700 hover:border-indigo-500 transition-colors"
                    >
                      {artworkUrls[track.id] ? (
                        <img src={artworkUrls[track.id]} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <Music size={16} className="text-zinc-600" />
                      )}
                      <div className={`absolute inset-0 flex items-center justify-center transition-all ${
                        currentTrack?.id === track.id && isPlaying
                          ? 'opacity-100 bg-indigo-600/80'
                          : currentTrack?.id === track.id
                          ? 'opacity-100 bg-black/70'
                          : 'opacity-0 group-hover:opacity-100 bg-black/70'
                      }`}>
                        {currentTrack?.id === track.id && isPlaying ? (
                          <Pause size={18} className="text-white" fill="currentColor" />
                        ) : (
                          <Play size={18} className="text-white ml-0.5" fill="currentColor" />
                        )}
                      </div>
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium">{track.title}</p>
                    {track.artist && <p className="text-xs text-zinc-500">{track.artist}</p>}
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-500 uppercase hidden sm:table-cell">{track.format}</td>
                  <td className="px-4 py-3 text-xs text-zinc-500 hidden sm:table-cell">{formatSize(track.file_size)}</td>
                  <td className="px-4 py-3 text-sm text-zinc-400 tabular-nums">{formatDuration(track.duration)}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setInfoTrack(track)}
                      className="text-zinc-500 hover:text-indigo-400 transition-colors"
                      title="View metadata"
                    >
                      <Info size={14} />
                    </button>
                  </td>
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
          onClose={handleUploaderClose}
          initialFiles={droppedFiles.length > 0 ? droppedFiles : undefined}
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
              {showCreateNew ? (
                <div className="p-3">
                  <p className="text-xs text-zinc-500 uppercase tracking-wider mb-3">New playlist name</p>
                  <input
                    type="text"
                    value={newPlaylistTitle}
                    onChange={(e) => setNewPlaylistTitle(e.target.value)}
                    placeholder="Enter playlist name..."
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
                    autoFocus
                  />
                  <button
                    onClick={() => { setShowCreateNew(false); setNewPlaylistTitle('') }}
                    className="text-xs text-zinc-400 hover:text-white mt-3"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <>
                  {/* Create New Playlist option */}
                  <button
                    onClick={() => { setShowCreateNew(true); setSelectedPlaylist(null) }}
                    className="w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors hover:bg-zinc-800 flex items-center gap-2 text-indigo-400"
                  >
                    <Plus size={16} />
                    Create New Playlist
                  </button>

                  {playlists.length > 0 && (
                    <>
                      <p className="text-xs text-zinc-500 px-3 py-2 mt-2 uppercase tracking-wider">Or add to existing</p>
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
                </>
              )}
            </div>
            {(selectedPlaylist || (showCreateNew && newPlaylistTitle.trim())) && (
              <div className="p-4 border-t border-zinc-800">
                <button
                  onClick={showCreateNew ? handleCreateAndAdd : handleAddToPlaylist}
                  disabled={adding}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg transition-colors text-sm"
                >
                  {adding ? 'Adding...' : showCreateNew ? `Create & Add Tracks` : `Add to Playlist`}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Track Info Modal */}
      {infoTrack && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-md max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-zinc-800">
              <h2 className="font-semibold">Track Metadata</h2>
              <button onClick={() => setInfoTrack(null)} className="text-zinc-400 hover:text-white">
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              {/* Artwork */}
              {artworkUrls[infoTrack.id] && (
                <div className="mb-4 flex justify-center">
                  <img
                    src={artworkUrls[infoTrack.id]}
                    alt=""
                    className="w-32 h-32 rounded-lg object-cover shadow-lg"
                  />
                </div>
              )}

              <div className="space-y-3">
                <MetadataRow label="Title" value={infoTrack.title} />
                <MetadataRow label="Artist" value={infoTrack.artist} />
                <MetadataRow label="Album" value={infoTrack.album} />
                <MetadataRow label="Year" value={infoTrack.year?.toString()} />
                <MetadataRow label="Genre" value={infoTrack.genre} />
                <MetadataRow label="Composer" value={infoTrack.composer} />
                <MetadataRow label="BPM" value={infoTrack.bpm?.toString()} />
                <MetadataRow label="Key" value={infoTrack.key} />
                <MetadataRow label="ISRC" value={infoTrack.isrc} />
                <MetadataRow label="Copyright" value={infoTrack.copyright} />
                <MetadataRow label="Comment" value={infoTrack.comment} />
                <div className="border-t border-zinc-800 pt-3 mt-3">
                  <MetadataRow label="Duration" value={formatDuration(infoTrack.duration)} />
                  <MetadataRow label="Format" value={infoTrack.format?.toUpperCase()} />
                  <MetadataRow label="File Size" value={formatSize(infoTrack.file_size)} />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function MetadataRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null
  return (
    <div className="flex">
      <span className="text-xs text-zinc-500 w-24 shrink-0">{label}</span>
      <span className="text-sm text-white">{value}</span>
    </div>
  )
}
