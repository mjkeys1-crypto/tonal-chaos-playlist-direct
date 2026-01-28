import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Trash2, ChevronDown, ChevronRight, GripVertical, Music, Loader2, Play, Share2 } from 'lucide-react'
import {
  getPlaylist, listSections, listPlaylistTracks, createSection, deleteSection,
  addTrackToPlaylist, removeTrackFromPlaylist, deletePlaylist, updatePlaylist,
} from '../lib/api/playlists'
import { listTracks, getSignedUrl } from '../lib/api/tracks'
import { usePlayer } from '../context/PlayerContext'
import ShareDialog from '../components/shares/ShareDialog'
import type { Playlist, Section, PlaylistTrack, Track } from '../lib/types'

function formatDuration(s: number | null) {
  if (!s) return '--:--'
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`
}

export default function PlaylistDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { play, currentTrack, isPlaying, pause, resume } = usePlayer()

  const [playlist, setPlaylist] = useState<Playlist | null>(null)
  const [sections, setSections] = useState<Section[]>([])
  const [playlistTracks, setPlaylistTracks] = useState<PlaylistTrack[]>([])
  const [allTracks, setAllTracks] = useState<Track[]>([])
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [showAddTracks, setShowAddTracks] = useState<string | null>(null) // section ID or 'unsectioned'
  const [showAddSection, setShowAddSection] = useState(false)
  const [newSectionTitle, setNewSectionTitle] = useState('')
  const [newSectionEmoji, setNewSectionEmoji] = useState('')
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')
  const [showShare, setShowShare] = useState(false)

  const loadData = useCallback(async () => {
    if (!id) return
    const [pl, secs, pts, tracks] = await Promise.all([
      getPlaylist(id),
      listSections(id),
      listPlaylistTracks(id),
      listTracks(),
    ])
    setPlaylist(pl)
    setSections(secs)
    setPlaylistTracks(pts)
    setAllTracks(tracks)
    setExpandedSections(new Set(secs.map(s => s.id)))
    setLoading(false)
  }, [id])

  useEffect(() => { loadData() }, [loadData])

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

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev)
      next.has(sectionId) ? next.delete(sectionId) : next.add(sectionId)
      return next
    })
  }

  const handleAddSection = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!id || !newSectionTitle.trim()) return
    await createSection(id, newSectionTitle.trim(), newSectionEmoji.trim() || null, sections.length)
    setNewSectionTitle('')
    setNewSectionEmoji('')
    setShowAddSection(false)
    loadData()
  }

  const handleDeleteSection = async (sectionId: string) => {
    if (!confirm('Delete this section? Tracks in it will be removed from the playlist.')) return
    await deleteSection(sectionId)
    loadData()
  }

  const handleAddTrack = async (trackId: string, sectionId: string | null) => {
    if (!id) return
    const sectionTracks = playlistTracks.filter(pt =>
      sectionId ? pt.section_id === sectionId : !pt.section_id
    )
    await addTrackToPlaylist(id, trackId, sectionId, sectionTracks.length)
    setShowAddTracks(null)
    loadData()
  }

  const handleRemoveTrack = async (ptId: string) => {
    await removeTrackFromPlaylist(ptId)
    loadData()
  }

  const handleDeletePlaylist = async () => {
    if (!confirm('Delete this playlist?')) return
    await deletePlaylist(id!)
    navigate('/playlists')
  }

  const handleSaveTitle = async () => {
    if (!id || !titleDraft.trim()) return
    await updatePlaylist(id, { title: titleDraft.trim() })
    setPlaylist(prev => prev ? { ...prev, title: titleDraft.trim() } : prev)
    setEditingTitle(false)
  }

  // Get tracks not already in the playlist (for the add dialog)
  const availableTracks = allTracks.filter(t => !playlistTracks.some(pt => pt.track_id === t.id))

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-zinc-500" size={24} />
      </div>
    )
  }

  if (!playlist) {
    return <div className="p-8 text-zinc-400">Playlist not found.</div>
  }

  const renderTrackList = (sectionId: string | null) => {
    const tracks = playlistTracks
      .filter(pt => sectionId ? pt.section_id === sectionId : !pt.section_id)
      .sort((a, b) => a.position - b.position)

    return (
      <div className="space-y-1">
        {tracks.map(pt => {
          const track = pt.track
          if (!track) return null
          return (
            <div
              key={pt.id}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg group hover:bg-zinc-800/50 ${
                currentTrack?.id === track.id ? 'bg-zinc-800/50' : ''
              }`}
            >
              <GripVertical size={14} className="text-zinc-600 cursor-grab" />
              <button onClick={() => handlePlay(track)} className="text-zinc-400 hover:text-white">
                <Play size={14} fill={currentTrack?.id === track.id && isPlaying ? 'currentColor' : 'none'} />
              </button>
              <span className="flex-1 text-sm truncate">{track.title}</span>
              <span className="text-xs text-zinc-500 tabular-nums">{formatDuration(track.duration)}</span>
              <button
                onClick={() => handleRemoveTrack(pt.id)}
                className="text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 size={14} />
              </button>
            </div>
          )
        })}
        <button
          onClick={() => setShowAddTracks(sectionId || 'unsectioned')}
          className="flex items-center gap-2 px-3 py-2 text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          <Plus size={14} />
          Add track
        </button>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-3xl">
      {/* Header */}
      <button onClick={() => navigate('/playlists')} className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white mb-4 transition-colors">
        <ArrowLeft size={16} />
        Back to Playlists
      </button>

      <div className="flex items-start justify-between mb-6">
        <div>
          {editingTitle ? (
            <div className="flex items-center gap-2">
              <input
                value={titleDraft}
                onChange={e => setTitleDraft(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSaveTitle()}
                className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1 text-xl font-bold text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                autoFocus
              />
              <button onClick={handleSaveTitle} className="text-sm text-indigo-400 hover:text-indigo-300">Save</button>
              <button onClick={() => setEditingTitle(false)} className="text-sm text-zinc-500 hover:text-zinc-300">Cancel</button>
            </div>
          ) : (
            <h1
              className="text-2xl font-bold cursor-pointer hover:text-zinc-300 transition-colors"
              onClick={() => { setTitleDraft(playlist.title); setEditingTitle(true) }}
            >
              {playlist.title}
            </h1>
          )}
          {playlist.client_name && (
            <p className="text-sm text-zinc-400 mt-1">For {playlist.client_name}</p>
          )}
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowShare(true)} className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-sm px-3 py-2 rounded-lg transition-colors">
            <Share2 size={14} />
            Share
          </button>
          <button
            onClick={handleDeletePlaylist}
            className="text-zinc-500 hover:text-red-400 px-3 py-2 transition-colors"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* Sections */}
      <div className="space-y-4">
        {sections.map(section => (
          <div key={section.id} className="border border-zinc-800 rounded-lg overflow-hidden">
            <button
              onClick={() => toggleSection(section.id)}
              className="w-full flex items-center gap-3 px-4 py-3 bg-zinc-900 hover:bg-zinc-800/80 transition-colors text-left"
            >
              {expandedSections.has(section.id) ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              <span className="text-base">
                {section.emoji && <span className="mr-2">{section.emoji}</span>}
                <span className="font-medium">{section.title}</span>
              </span>
              <span className="text-xs text-zinc-500 ml-auto">
                {playlistTracks.filter(pt => pt.section_id === section.id).length} tracks
              </span>
              <button
                onClick={e => { e.stopPropagation(); handleDeleteSection(section.id) }}
                className="text-zinc-600 hover:text-red-400 ml-2 transition-colors"
              >
                <Trash2 size={14} />
              </button>
            </button>
            {expandedSections.has(section.id) && (
              <div className="px-4 py-2">
                {renderTrackList(section.id)}
              </div>
            )}
          </div>
        ))}

        {/* Unsectioned tracks */}
        {playlistTracks.some(pt => !pt.section_id) && (
          <div className="border border-zinc-800 rounded-lg p-4">
            <p className="text-sm text-zinc-500 mb-2">Unsectioned</p>
            {renderTrackList(null)}
          </div>
        )}

        {/* Add section */}
        {showAddSection ? (
          <form onSubmit={handleAddSection} className="border border-zinc-700 rounded-lg p-4 space-y-3">
            <div className="flex gap-3">
              <input
                value={newSectionEmoji}
                onChange={e => setNewSectionEmoji(e.target.value)}
                placeholder="Emoji"
                className="w-16 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-center text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <input
                value={newSectionTitle}
                onChange={e => setNewSectionTitle(e.target.value)}
                placeholder="Section title (e.g. Horror)"
                required
                className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                autoFocus
              />
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setShowAddSection(false)} className="text-sm text-zinc-500 hover:text-zinc-300">Cancel</button>
              <button type="submit" className="text-sm text-indigo-400 hover:text-indigo-300 font-medium">Add Section</button>
            </div>
          </form>
        ) : (
          <button
            onClick={() => setShowAddSection(true)}
            className="flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <Plus size={16} />
            Add Section
          </button>
        )}
      </div>

      {/* Add track modal */}
      {showAddTracks && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-md max-h-[70vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-zinc-800">
              <h2 className="font-semibold">Add Track</h2>
              <button onClick={() => setShowAddTracks(null)} className="text-zinc-400 hover:text-white text-sm">Close</button>
            </div>
            <div className="flex-1 overflow-auto p-2">
              {availableTracks.length === 0 ? (
                <p className="text-sm text-zinc-500 p-4 text-center">No available tracks. Upload some first.</p>
              ) : (
                availableTracks.map(track => (
                  <button
                    key={track.id}
                    onClick={() => handleAddTrack(track.id, showAddTracks === 'unsectioned' ? null : showAddTracks)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-zinc-800 text-left transition-colors"
                  >
                    <Music size={14} className="text-zinc-500" />
                    <span className="flex-1 text-sm truncate">{track.title}</span>
                    <span className="text-xs text-zinc-500 tabular-nums">{formatDuration(track.duration)}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
      {showShare && id && (
        <ShareDialog playlistId={id} onClose={() => setShowShare(false)} />
      )}
    </div>
  )
}
