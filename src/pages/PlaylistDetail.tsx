import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Trash2, ChevronDown, ChevronRight, GripVertical, Music, Loader2, Play, Share2, Library, X, Upload, Pencil } from 'lucide-react'
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, useSortable, verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  getPlaylist, listSections, listPlaylistTracks, createSection, deleteSection,
  addTrackToPlaylist, removeTrackFromPlaylist, deletePlaylist, updatePlaylist,
  reorderPlaylistTracks, updateSection,
} from '../lib/api/playlists'
import { listTracks, getSignedUrl, uploadTrack } from '../lib/api/tracks'
import { usePlayer } from '../context/PlayerContext'
import { useAuth } from '../context/AuthContext'
import ShareDialog from '../components/shares/ShareDialog'
import type { Playlist, Section, PlaylistTrack, Track } from '../lib/types'

function formatDuration(s: number | null) {
  if (!s) return '--:--'
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`
}

// ─── Sortable Track Row ───
function SortableTrackRow({
  pt, currentTrack, isPlaying, onPlay, onRemove,
}: {
  pt: PlaylistTrack
  currentTrack: Track | null
  isPlaying: boolean
  onPlay: (t: Track) => void
  onRemove: (id: string) => void
}) {
  const track = pt.track
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: pt.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }

  if (!track) return null
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 px-3 py-2 rounded-lg group hover:bg-zinc-800/50 ${
        currentTrack?.id === track.id ? 'bg-zinc-800/50' : ''
      }`}
    >
      <button {...attributes} {...listeners} className="touch-none text-zinc-600 hover:text-zinc-400 cursor-grab active:cursor-grabbing">
        <GripVertical size={14} />
      </button>
      <button onClick={() => onPlay(track)} className="text-zinc-400 hover:text-white">
        <Play size={14} fill={currentTrack?.id === track.id && isPlaying ? 'currentColor' : 'none'} />
      </button>
      <span className="flex-1 text-sm truncate">{track.title}</span>
      <span className="text-xs text-zinc-500 tabular-nums">{formatDuration(track.duration)}</span>
      <button
        onClick={() => onRemove(pt.id)}
        className="text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <Trash2 size={14} />
      </button>
    </div>
  )
}

// ─── Sortable Section ───
function SortableSectionHeader({
  section, trackCount, expanded, onToggle, onDelete, onRename, listeners, attributes,
}: {
  section: Section
  trackCount: number
  expanded: boolean
  onToggle: () => void
  onDelete: () => void
  onRename: (title: string, emoji: string | null) => void
  listeners: any
  attributes: any
}) {
  const [editing, setEditing] = useState(false)
  const [editTitle, setEditTitle] = useState(section.title)
  const [editEmoji, setEditEmoji] = useState(section.emoji || '')

  const handleSave = () => {
    if (editTitle.trim()) {
      onRename(editTitle.trim(), editEmoji.trim() || null)
    }
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2 px-4 py-3 bg-zinc-900">
        <input
          value={editEmoji}
          onChange={e => setEditEmoji(e.target.value)}
          placeholder="🎵"
          className="w-12 bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1 text-center text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <input
          value={editTitle}
          onChange={e => setEditTitle(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditing(false) }}
          className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          autoFocus
        />
        <button onClick={handleSave} className="text-xs text-indigo-400 hover:text-indigo-300 font-medium">Save</button>
        <button onClick={() => setEditing(false)} className="text-xs text-zinc-500 hover:text-zinc-300">Cancel</button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-zinc-900 hover:bg-zinc-800/80 transition-colors group">
      <button {...attributes} {...listeners} className="touch-none text-zinc-600 hover:text-zinc-400 cursor-grab active:cursor-grabbing">
        <GripVertical size={16} />
      </button>
      <button onClick={onToggle} className="flex items-center gap-3 flex-1 text-left">
        {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        <span className="text-base">
          {section.emoji && <span className="mr-2">{section.emoji}</span>}
          <span className="font-medium">{section.title}</span>
        </span>
        <span className="text-xs text-zinc-500 ml-auto">{trackCount} tracks</span>
      </button>
      <button
        onClick={() => { setEditTitle(section.title); setEditEmoji(section.emoji || ''); setEditing(true) }}
        className="text-zinc-600 hover:text-zinc-300 opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <Pencil size={13} />
      </button>
      <button
        onClick={onDelete}
        className="text-zinc-600 hover:text-red-400 ml-1 transition-colors"
      >
        <Trash2 size={14} />
      </button>
    </div>
  )
}

function SortableSection({
  section, trackCount, expanded, onToggle, onDelete, onRename, children,
}: {
  section: Section
  trackCount: number
  expanded: boolean
  onToggle: () => void
  onDelete: () => void
  onRename: (title: string, emoji: string | null) => void
  children: React.ReactNode
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: section.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }

  return (
    <div ref={setNodeRef} style={style} className="border border-zinc-800 rounded-lg overflow-hidden">
      <SortableSectionHeader
        section={section}
        trackCount={trackCount}
        expanded={expanded}
        onToggle={onToggle}
        onDelete={onDelete}
        onRename={onRename}
        listeners={listeners}
        attributes={attributes}
      />
      {expanded && children}
    </div>
  )
}

// ─── Main Component ───
export default function PlaylistDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { play, currentTrack, isPlaying, pause, resume } = usePlayer()
  const { user } = useAuth()

  const [playlist, setPlaylist] = useState<Playlist | null>(null)
  const [sections, setSections] = useState<Section[]>([])
  const [playlistTracks, setPlaylistTracks] = useState<PlaylistTrack[]>([])
  const [allTracks, setAllTracks] = useState<Track[]>([])
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [showAddSection, setShowAddSection] = useState(false)
  const [newSectionTitle, setNewSectionTitle] = useState('')
  const [newSectionEmoji, setNewSectionEmoji] = useState('')
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')
  const [showShare, setShowShare] = useState(false)
  const [showLibrary, setShowLibrary] = useState(false)
  const [libraryTarget, setLibraryTarget] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

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
    setExpandedSections(prev => prev.size > 0 ? prev : new Set(secs.map(s => s.id)))
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

  const handleRenameSection = async (sectionId: string, title: string, emoji: string | null) => {
    await updateSection(sectionId, { title, emoji })
    setSections(prev => prev.map(s => s.id === sectionId ? { ...s, title, emoji } : s))
  }

  const handleDeleteSection = async (sectionId: string) => {
    if (!confirm('Delete this section? Tracks in it will be removed from the playlist.')) return
    await deleteSection(sectionId)
    loadData()
  }

  const handleAddTrackFromLibrary = async (trackId: string) => {
    if (!id) return
    const sectionTracks = playlistTracks.filter(pt =>
      libraryTarget ? pt.section_id === libraryTarget : !pt.section_id
    )
    await addTrackToPlaylist(id, trackId, libraryTarget, sectionTracks.length)
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

  const openLibrary = (sectionId: string | null) => {
    setLibraryTarget(sectionId)
    setShowLibrary(true)
  }

  // Upload files directly into the playlist
  const handleUploadToPlaylist = async (sectionId: string | null) => {
    if (!user || !id) return
    const input = document.createElement('input')
    input.type = 'file'
    input.multiple = true
    input.accept = 'audio/*'
    input.onchange = async () => {
      if (!input.files?.length) return
      setUploading(true)
      const files = Array.from(input.files)
      const sectionTracks = playlistTracks.filter(pt =>
        sectionId ? pt.section_id === sectionId : !pt.section_id
      )
      let pos = sectionTracks.length
      for (const file of files) {
        try {
          const track = await uploadTrack(file, user.id)
          await addTrackToPlaylist(id, track.id, sectionId, pos)
          pos++
        } catch (err) {
          console.error('Upload failed:', err)
        }
      }
      setUploading(false)
      loadData()
    }
    input.click()
  }

  // ─── Drag-to-reorder tracks ───
  const handleTrackDragEnd = (sectionId: string | null) => async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const filtered = playlistTracks
      .filter(pt => sectionId ? pt.section_id === sectionId : !pt.section_id)
      .sort((a, b) => a.position - b.position)

    const oldIndex = filtered.findIndex(pt => pt.id === active.id)
    const newIndex = filtered.findIndex(pt => pt.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    const reordered = arrayMove(filtered, oldIndex, newIndex)
    // Optimistic update
    const updated = playlistTracks.map(pt => {
      const idx = reordered.findIndex(r => r.id === pt.id)
      return idx >= 0 ? { ...pt, position: idx } : pt
    })
    setPlaylistTracks(updated)

    // Persist
    await reorderPlaylistTracks(reordered.map((pt, i) => ({ id: pt.id, position: i, section_id: pt.section_id })))
  }

  // ─── Drag-to-reorder sections ───
  const handleSectionDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = sections.findIndex(s => s.id === active.id)
    const newIndex = sections.findIndex(s => s.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    const reordered = arrayMove(sections, oldIndex, newIndex)
    setSections(reordered)

    // Persist positions
    for (let i = 0; i < reordered.length; i++) {
      await updateSection(reordered[i].id, { position: i })
    }
  }

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
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleTrackDragEnd(sectionId)}>
          <SortableContext items={tracks.map(pt => pt.id)} strategy={verticalListSortingStrategy}>
            {tracks.map(pt => (
              <SortableTrackRow
                key={pt.id}
                pt={pt}
                currentTrack={currentTrack}
                isPlaying={isPlaying}
                onPlay={handlePlay}
                onRemove={handleRemoveTrack}
              />
            ))}
          </SortableContext>
        </DndContext>
        <div className="flex items-center gap-2">
          <button
            onClick={() => openLibrary(sectionId)}
            className="flex items-center gap-2 px-3 py-2 text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <Plus size={14} />
            Add track
          </button>
          <button
            onClick={() => handleUploadToPlaylist(sectionId)}
            disabled={uploading}
            className="flex items-center gap-2 px-3 py-2 text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <Upload size={14} />
            {uploading ? 'Uploading...' : 'Upload'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex">
      <div className={`p-8 flex-1 max-w-3xl transition-all ${showLibrary ? 'mr-80' : ''}`}>
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
            <button
              onClick={() => setShowLibrary(!showLibrary)}
              className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg transition-colors ${
                showLibrary ? 'bg-indigo-600 hover:bg-indigo-500 text-white' : 'bg-zinc-800 hover:bg-zinc-700'
              }`}
            >
              <Library size={14} />
              Track Library
            </button>
            <button onClick={() => setShowShare(true)} className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-sm px-3 py-2 rounded-lg transition-colors">
              <Share2 size={14} />
              Share
            </button>
            <button onClick={handleDeletePlaylist} className="text-zinc-500 hover:text-red-400 px-3 py-2 transition-colors">
              <Trash2 size={16} />
            </button>
          </div>
        </div>

        {/* Sections (sortable) */}
        <div className="space-y-4">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleSectionDragEnd}>
            <SortableContext items={sections.map(s => s.id)} strategy={verticalListSortingStrategy}>
              {sections.map(section => (
                <SortableSection
                  key={section.id}
                  section={section}
                  trackCount={playlistTracks.filter(pt => pt.section_id === section.id).length}
                  expanded={expandedSections.has(section.id)}
                  onToggle={() => toggleSection(section.id)}
                  onDelete={() => handleDeleteSection(section.id)}
                  onRename={(title, emoji) => handleRenameSection(section.id, title, emoji)}
                >
                  <div className="px-4 py-2">
                    {renderTrackList(section.id)}
                  </div>
                </SortableSection>
              ))}
            </SortableContext>
          </DndContext>

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

        {showShare && id && (
          <ShareDialog playlistId={id} onClose={() => setShowShare(false)} />
        )}
      </div>

      {/* Track Library Sidebar */}
      {showLibrary && (
        <div className="fixed right-0 top-0 bottom-0 w-80 bg-zinc-900 border-l border-zinc-800 flex flex-col z-40">
          <div className="flex items-center justify-between p-4 border-b border-zinc-800">
            <h2 className="font-semibold text-sm">Track Library</h2>
            <button onClick={() => setShowLibrary(false)} className="text-zinc-400 hover:text-white">
              <X size={18} />
            </button>
          </div>

          {sections.length > 0 && (
            <div className="px-4 py-3 border-b border-zinc-800">
              <p className="text-xs text-zinc-500 mb-2 uppercase tracking-wider">Add to</p>
              <select
                value={libraryTarget ?? ''}
                onChange={e => setLibraryTarget(e.target.value || null)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Unsectioned</option>
                {sections.map(sec => (
                  <option key={sec.id} value={sec.id}>
                    {sec.emoji ? `${sec.emoji} ` : ''}{sec.title}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex-1 overflow-auto p-2">
            {availableTracks.length === 0 ? (
              <p className="text-sm text-zinc-500 p-4 text-center">All tracks are in this playlist.</p>
            ) : (
              availableTracks.map(track => (
                <button
                  key={track.id}
                  onClick={() => handleAddTrackFromLibrary(track.id)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-zinc-800 text-left transition-colors group"
                >
                  <Music size={14} className="text-zinc-500 shrink-0" />
                  <span className="flex-1 text-sm truncate">{track.title}</span>
                  <span className="text-xs text-zinc-500 tabular-nums shrink-0">{formatDuration(track.duration)}</span>
                  <Plus size={14} className="text-zinc-600 group-hover:text-indigo-400 shrink-0 transition-colors" />
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
