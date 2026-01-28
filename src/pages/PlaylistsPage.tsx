import { useEffect, useState, useCallback } from 'react'
import { Plus, ListMusic, Loader2, Copy, Trash2, Music, GripVertical, ChevronDown, ChevronRight, ChevronUp, Share2, Library, X, Upload, Pencil, Play, Pause } from 'lucide-react'
import { listPlaylists, createPlaylist, duplicatePlaylist, deletePlaylist, getArtworkUrl, getPlaylist, listSections, listPlaylistTracks, createSection, deleteSection, addTrackToPlaylist, removeTrackFromPlaylist, updatePlaylist, reorderPlaylistTracks, updateSection, uploadPlaylistArtwork } from '../lib/api/playlists'
import { listTracks, getSignedUrl, uploadTrack, getTrackArtworkUrl } from '../lib/api/tracks'
import { useAuth } from '../context/AuthContext'
import { usePlayer } from '../context/PlayerContext'
import ShareDialog from '../components/shares/ShareDialog'
import type { Playlist, Section, PlaylistTrack, Track } from '../lib/types'
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors, useDroppable,
  type DragEndEvent, type DragStartEvent, DragOverlay,
} from '@dnd-kit/core'
import {
  SortableContext, useSortable, verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

function formatDuration(s: number | null) {
  if (!s) return '--:--'
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`
}

// ─── Sortable Track Row ───
function SortableTrackRow({
  pt, currentTrack, isPlaying, onPlay, onRemove, artworkUrl,
}: {
  pt: PlaylistTrack
  currentTrack: Track | null
  isPlaying: boolean
  onPlay: (t: Track) => void
  onRemove: (id: string) => void
  artworkUrl?: string
}) {
  const track = pt.track
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: pt.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }

  if (!track) return null
  const isCurrent = currentTrack?.id === track.id

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 px-3 py-2 rounded-lg group hover:bg-zinc-800/50 ${
        isCurrent ? 'bg-zinc-800/50' : ''
      }`}
    >
      <button {...attributes} {...listeners} className="touch-none text-zinc-500 hover:text-zinc-300 cursor-grab active:cursor-grabbing p-1 -ml-1 rounded hover:bg-zinc-700/50 transition-colors" title="Drag to reorder">
        <GripVertical size={16} />
      </button>
      <button
        onClick={() => onPlay(track)}
        className="relative w-9 h-9 rounded-md bg-zinc-800 flex items-center justify-center shrink-0 overflow-hidden group/play"
      >
        {artworkUrl ? (
          <img src={artworkUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <Music size={14} className="text-zinc-600" />
        )}
        <div className={`absolute inset-0 flex items-center justify-center transition-opacity ${
          isCurrent && isPlaying
            ? 'opacity-100 bg-indigo-600/80'
            : isCurrent
            ? 'opacity-100 bg-black/60'
            : 'opacity-0 group-hover/play:opacity-100 bg-black/60'
        }`}>
          {isCurrent && isPlaying ? (
            <Pause size={14} className="text-white" fill="currentColor" />
          ) : (
            <Play size={14} className="text-white ml-0.5" fill="currentColor" />
          )}
        </div>
      </button>
      <span className="flex-1 text-sm truncate">{track.title}</span>
      <span className="text-xs text-zinc-500 tabular-nums">{formatDuration(track.duration)}</span>
      <button
        onClick={() => onRemove(pt.id)}
        className="text-zinc-500 hover:text-red-400 p-1 rounded hover:bg-zinc-700/50 transition-colors shrink-0"
        title="Remove from playlist"
      >
        <X size={14} />
      </button>
    </div>
  )
}

// ─── Sortable Section Wrapper ───
function SortableSection({
  section, trackCount, expanded, onToggle, onDelete, onRename, onMoveUp, onMoveDown, isFirst, isLast, children,
}: {
  section: Section
  trackCount: number
  expanded: boolean
  onToggle: () => void
  onDelete: () => void
  onRename: (title: string, emoji: string | null) => void
  onMoveUp: () => void
  onMoveDown: () => void
  isFirst: boolean
  isLast: boolean
  children?: React.ReactNode
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `section-${section.id}`,
  })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} className="border border-zinc-800 rounded-lg overflow-hidden">
      <SortableSectionHeader
        section={section}
        trackCount={trackCount}
        expanded={expanded}
        onToggle={onToggle}
        onDelete={onDelete}
        onRename={onRename}
        onMoveUp={onMoveUp}
        onMoveDown={onMoveDown}
        isFirst={isFirst}
        isLast={isLast}
        listeners={listeners}
        attributes={attributes}
      />
      {children}
    </div>
  )
}

// ─── Sortable Section Header ───
function SortableSectionHeader({
  section, trackCount, expanded, onToggle, onDelete, onRename, onMoveUp, onMoveDown, isFirst, isLast, listeners, attributes,
}: {
  section: Section
  trackCount: number
  expanded: boolean
  onToggle: () => void
  onDelete: () => void
  onRename: (title: string, emoji: string | null) => void
  onMoveUp: () => void
  onMoveDown: () => void
  isFirst: boolean
  isLast: boolean
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
    <div className="flex items-center gap-2 px-4 py-3 bg-zinc-900 hover:bg-zinc-800/80 transition-colors group">
      <div className="flex flex-col -my-1">
        <button
          onClick={onMoveUp}
          disabled={isFirst}
          className="text-zinc-500 hover:text-zinc-300 disabled:opacity-30 disabled:cursor-not-allowed p-0.5 rounded hover:bg-zinc-700/50 transition-colors"
          title="Move up"
        >
          <ChevronUp size={14} />
        </button>
        <button
          onClick={onMoveDown}
          disabled={isLast}
          className="text-zinc-500 hover:text-zinc-300 disabled:opacity-30 disabled:cursor-not-allowed p-0.5 rounded hover:bg-zinc-700/50 transition-colors"
          title="Move down"
        >
          <ChevronDown size={14} />
        </button>
      </div>
      <button {...attributes} {...listeners} className="touch-none text-zinc-500 hover:text-zinc-300 cursor-grab active:cursor-grabbing p-1 rounded hover:bg-zinc-700/50">
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
        className="text-zinc-400 hover:text-indigo-400 p-1 rounded hover:bg-zinc-700/50 transition-colors"
        title="Edit section name"
      >
        <Pencil size={14} />
      </button>
      <button
        onClick={onDelete}
        className="text-zinc-500 hover:text-red-400 p-1 rounded hover:bg-zinc-700/50 transition-colors"
        title="Delete section"
      >
        <Trash2 size={14} />
      </button>
    </div>
  )
}


// ─── Playlist Detail Panel ───
function PlaylistDetailPanel({
  playlistId,
  onClose,
  onPlaylistDeleted,
}: {
  playlistId: string
  onClose: () => void
  onPlaylistDeleted: (id: string) => void
}) {
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
  const [editingClient, setEditingClient] = useState(false)
  const [clientDraft, setClientDraft] = useState('')
  const [editingDescription, setEditingDescription] = useState(false)
  const [descriptionDraft, setDescriptionDraft] = useState('')
  const [showShare, setShowShare] = useState(false)
  const [showLibrary, setShowLibrary] = useState(false)
  const [libraryTarget, setLibraryTarget] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [libraryDragOver, setLibraryDragOver] = useState(false)
  const [libraryUploading, setLibraryUploading] = useState(false)
  const [artworkUrl, setArtworkUrl] = useState<string | null>(null)
  const [uploadingArtwork, setUploadingArtwork] = useState(false)
  const [trackArtworkUrls, setTrackArtworkUrls] = useState<Record<string, string>>({})
  const [unsectionedLabel, setUnsectionedLabelState] = useState('Unsectioned')
  const [editingUnsectioned, setEditingUnsectioned] = useState(false)
  const [unsectionedDraft, setUnsectionedDraft] = useState('')

  // Load unsectioned label from localStorage on mount
  useEffect(() => {
    if (playlistId) {
      const saved = localStorage.getItem(`unsectioned-label-${playlistId}`)
      if (saved) setUnsectionedLabelState(saved)
    }
  }, [playlistId])

  // Wrapper to save to localStorage when label changes
  const setUnsectionedLabel = (label: string) => {
    setUnsectionedLabelState(label)
    if (playlistId) {
      localStorage.setItem(`unsectioned-label-${playlistId}`, label)
    }
  }

  // Convert unsectioned tracks into a real section
  const handleConvertToSection = async (title: string) => {
    if (!playlistId) return

    // Get unsectioned tracks
    const unsectionedTracks = playlistTracks.filter(pt => !pt.section_id)
    if (unsectionedTracks.length === 0) return

    try {
      // Create a new section at position 0 (top)
      const newSection = await createSection(playlistId, title, null, 0)

      // Update positions of existing sections
      const updatedSections = sections.map(s => ({ ...s, position: s.position + 1 }))
      for (const s of updatedSections) {
        await updateSection(s.id, { position: s.position })
      }

      // Move all unsectioned tracks to the new section
      const updates = unsectionedTracks.map((pt, i) => ({
        id: pt.id,
        position: i,
        section_id: newSection.id
      }))
      await reorderPlaylistTracks(updates)

      // Clear the localStorage label since it's now a real section
      localStorage.removeItem(`unsectioned-label-${playlistId}`)
      setUnsectionedLabelState('Unsectioned')

      // Reload data to get the updated state
      loadData()
    } catch (err) {
      console.error('Failed to convert to section:', err)
      alert('Failed to convert to section. Check console for details.')
    }
  }
  const [activeTrackId, setActiveTrackId] = useState<string | null>(null)
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const loadData = useCallback(async () => {
    if (!playlistId) return
    setLoading(true)
    const [pl, secs, pts, tracks] = await Promise.all([
      getPlaylist(playlistId),
      listSections(playlistId),
      listPlaylistTracks(playlistId),
      listTracks(),
    ])
    setPlaylist(pl)
    setSections(secs)
    setPlaylistTracks(pts)
    setAllTracks(tracks)
    setExpandedSections(prev => prev.size > 0 ? prev : new Set(secs.map(s => s.id)))
    setLoading(false)

    if (pl.artwork_path) {
      try {
        const url = await getArtworkUrl(pl.artwork_path)
        setArtworkUrl(url)
      } catch {
        setArtworkUrl(null)
      }
    } else {
      setArtworkUrl(null)
    }

    const artworkMap: Record<string, string> = {}
    await Promise.all(
      tracks.filter(t => t.artwork_path).map(async (t) => {
        try {
          artworkMap[t.id] = await getTrackArtworkUrl(t.artwork_path!)
        } catch {}
      })
    )
    setTrackArtworkUrls(artworkMap)
  }, [playlistId])

  useEffect(() => { loadData() }, [loadData])

  const handlePlay = async (track: Track) => {
    if (currentTrack?.id === track.id) {
      isPlaying ? pause() : resume()
      return
    }
    const path = track.storage_path || track.file_url
    if (!path) return
    const url = await getSignedUrl(path)
    play(track, url, trackArtworkUrls[track.id])
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
    if (!playlistId || !newSectionTitle.trim()) return
    const newSection = await createSection(playlistId, newSectionTitle.trim(), newSectionEmoji.trim() || null, sections.length)
    // Update local state immediately
    setSections(prev => [...prev, newSection])
    setExpandedSections(prev => new Set([...prev, newSection.id]))
    setNewSectionTitle('')
    setNewSectionEmoji('')
    setShowAddSection(false)
  }

  const handleRenameSection = async (sectionId: string, title: string, emoji: string | null) => {
    try {
      await updateSection(sectionId, { title, emoji })
      // Update local state immediately so UI reflects the change
      setSections(prev => prev.map(s => s.id === sectionId ? { ...s, title, emoji } : s))
    } catch (err) {
      console.error('Failed to update section:', err)
      alert('Failed to save section name. Check console for details.')
      // Reload to get correct state after error
      loadData()
    }
  }

  const handleDeleteSection = async (sectionId: string) => {
    if (!confirm('Delete this section? Tracks in it will be removed from the playlist.')) return
    await deleteSection(sectionId)
    loadData()
  }

  const handleMoveSection = async (sectionId: string, direction: 'up' | 'down') => {
    const currentIndex = sections.findIndex(s => s.id === sectionId)
    if (currentIndex === -1) return

    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
    if (newIndex < 0 || newIndex >= sections.length) return

    const reordered = arrayMove(sections, currentIndex, newIndex)
    setSections(reordered)

    try {
      await Promise.all(
        reordered.map((section, i) => updateSection(section.id, { position: i }))
      )
    } catch (err) {
      console.error('Failed to save section order:', err)
      loadData()
    }
  }

  const handleAddTrackFromLibrary = async (trackId: string) => {
    if (!playlistId) return
    const sectionTracks = playlistTracks.filter(pt =>
      libraryTarget ? pt.section_id === libraryTarget : !pt.section_id
    )
    await addTrackToPlaylist(playlistId, trackId, libraryTarget, sectionTracks.length)
    loadData()
  }

  const handleRemoveTrack = async (ptId: string) => {
    await removeTrackFromPlaylist(ptId)
    loadData()
  }

  const handleDeletePlaylist = async () => {
    if (!confirm('Delete this playlist?')) return
    await deletePlaylist(playlistId)
    onPlaylistDeleted(playlistId)
  }

  const handleSaveTitle = async () => {
    if (!playlistId || !titleDraft.trim()) return
    await updatePlaylist(playlistId, { title: titleDraft.trim() })
    setPlaylist(prev => prev ? { ...prev, title: titleDraft.trim() } : prev)
    setPlaylists(prev => prev.map(p => p.id === playlistId ? { ...p, title: titleDraft.trim() } : p))
    setEditingTitle(false)
  }

  const handleSaveClient = async () => {
    if (!playlistId) return
    const value = clientDraft.trim() || null
    await updatePlaylist(playlistId, { client_name: value })
    setPlaylist(prev => prev ? { ...prev, client_name: value } : prev)
    setPlaylists(prev => prev.map(p => p.id === playlistId ? { ...p, client_name: value } : p))
    setEditingClient(false)
  }

  const handleSaveDescription = async () => {
    if (!playlistId) return
    const value = descriptionDraft.trim() || null
    await updatePlaylist(playlistId, { description: value })
    setPlaylist(prev => prev ? { ...prev, description: value } : prev)
    setPlaylists(prev => prev.map(p => p.id === playlistId ? { ...p, description: value } : p))
    setEditingDescription(false)
  }

  const handleArtworkUpload = async () => {
    if (!playlistId) return
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      const maxSize = 5 * 1024 * 1024
      if (file.size > maxSize) {
        alert('Image must be under 5MB.')
        return
      }
      setUploadingArtwork(true)
      try {
        const path = await uploadPlaylistArtwork(playlistId, file)
        const url = await getArtworkUrl(path)
        setArtworkUrl(url)
        setPlaylist(prev => prev ? { ...prev, artwork_path: path } : prev)
      } catch (err: any) {
        alert('Failed to upload artwork: ' + (err.message || 'Unknown error'))
      } finally {
        setUploadingArtwork(false)
      }
    }
    input.click()
  }

  const openLibrary = (sectionId: string | null) => {
    setLibraryTarget(sectionId)
    setShowLibrary(true)
  }

  const handleUploadToPlaylist = async (sectionId: string | null) => {
    if (!user || !playlistId) return
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
          await addTrackToPlaylist(playlistId, track.id, sectionId, pos)
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

  // Upload files to library (not added to playlist yet)
  const handleLibraryUpload = async (files: FileList | File[]) => {
    if (!user) return
    const fileArray = Array.from(files).filter(f => f.type.startsWith('audio/'))
    if (fileArray.length === 0) return

    setLibraryUploading(true)
    for (const file of fileArray) {
      try {
        await uploadTrack(file, user.id)
      } catch (err) {
        console.error('Library upload failed:', err)
      }
    }
    setLibraryUploading(false)
    loadData()
  }

  const handleLibraryDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setLibraryDragOver(false)
    if (e.dataTransfer.files?.length) {
      handleLibraryUpload(e.dataTransfer.files)
    }
  }

  const handleLibraryDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    if (e.dataTransfer.types.includes('Files')) {
      setLibraryDragOver(true)
    }
  }

  const handleLibraryDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setLibraryDragOver(false)
  }

  const handleDragStart = (event: DragStartEvent) => {
    const id = event.active.id as string
    if (id.startsWith('section-')) {
      setActiveSectionId(id.replace('section-', ''))
    } else {
      setActiveTrackId(id)
    }
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveTrackId(null)
    setActiveSectionId(null)

    if (!over) return

    const activeId = active.id as string

    // Handle section reordering
    // Sortable sections have IDs like "section-{uuid}", droppable zones have "section-drop-{uuid}"
    if (activeId.startsWith('section-') && !activeId.startsWith('section-drop-')) {
      const overId = over.id as string
      const activeSectionId = activeId.replace('section-', '')

      // Extract target section ID - could be from sortable section or drop zone
      let overSectionId: string | null = null
      if (overId.startsWith('section-drop-')) {
        overSectionId = overId.replace('section-drop-', '')
      } else if (overId.startsWith('section-') && !overId.startsWith('section-drop-')) {
        overSectionId = overId.replace('section-', '')
      }

      if (!overSectionId || activeSectionId === overSectionId) return

      const oldIndex = sections.findIndex(s => s.id === activeSectionId)
      const newIndex = sections.findIndex(s => s.id === overSectionId)
      if (oldIndex === -1 || newIndex === -1) return

      const reordered = arrayMove(sections, oldIndex, newIndex)
      setSections(reordered)

      // Persist new positions
      try {
        await Promise.all(
          reordered.map((section, i) => updateSection(section.id, { position: i }))
        )
      } catch (err) {
        console.error('Failed to save section order:', err)
        // Revert on error
        loadData()
      }
      return
    }

    // Handle track dragging (existing logic)
    const activeTrack = playlistTracks.find(pt => pt.id === active.id)
    if (!activeTrack) return

    // Check if dropped on Library (remove from playlist)
    if (over.id === 'library-drop-zone') {
      await removeTrackFromPlaylist(activeTrack.id)
      loadData()
      return
    }

    // Check if dropped on a section header (move to that section)
    const sectionDropMatch = String(over.id).match(/^section-drop-(.+)$/)
    const unsectionedDrop = over.id === 'unsectioned-drop-zone'

    if (sectionDropMatch || unsectionedDrop) {
      const targetSectionId = sectionDropMatch ? sectionDropMatch[1] : null
      if (activeTrack.section_id !== targetSectionId) {
        // Move to new section
        const targetTracks = playlistTracks.filter(pt =>
          targetSectionId ? pt.section_id === targetSectionId : !pt.section_id
        )
        const newPosition = targetTracks.length

        // Update locally
        const updated = playlistTracks.map(pt =>
          pt.id === activeTrack.id ? { ...pt, section_id: targetSectionId, position: newPosition } : pt
        )
        setPlaylistTracks(updated)

        // Persist
        await reorderPlaylistTracks([{ id: activeTrack.id, position: newPosition, section_id: targetSectionId }])
      }
      return
    }

    // Reorder within same section or move to different section
    const overTrack = playlistTracks.find(pt => pt.id === over.id)
    if (!overTrack) return

    const sourceSectionId = activeTrack.section_id
    const targetSectionId = overTrack.section_id

    if (sourceSectionId === targetSectionId) {
      // Same section - just reorder
      const sectionTracks = playlistTracks
        .filter(pt => pt.section_id === sourceSectionId)
        .sort((a, b) => a.position - b.position)

      const oldIndex = sectionTracks.findIndex(pt => pt.id === active.id)
      const newIndex = sectionTracks.findIndex(pt => pt.id === over.id)
      if (oldIndex === -1 || newIndex === -1) return

      const reordered = arrayMove(sectionTracks, oldIndex, newIndex)
      const updated = playlistTracks.map(pt => {
        const idx = reordered.findIndex(r => r.id === pt.id)
        return idx >= 0 ? { ...pt, position: idx } : pt
      })
      setPlaylistTracks(updated)
      await reorderPlaylistTracks(reordered.map((pt, i) => ({ id: pt.id, position: i, section_id: pt.section_id })))
    } else {
      // Different section - move track
      const targetTracks = playlistTracks
        .filter(pt => pt.section_id === targetSectionId)
        .sort((a, b) => a.position - b.position)

      const overIndex = targetTracks.findIndex(pt => pt.id === over.id)
      const newPosition = overIndex >= 0 ? overIndex : targetTracks.length

      // Update locally
      const updated = playlistTracks.map(pt =>
        pt.id === activeTrack.id ? { ...pt, section_id: targetSectionId, position: newPosition } : pt
      )
      setPlaylistTracks(updated)

      // Persist
      await reorderPlaylistTracks([{ id: activeTrack.id, position: newPosition, section_id: targetSectionId }])
      loadData() // Refresh to get correct positions
    }
  }


  const availableTracks = allTracks.filter(t => !playlistTracks.some(pt => pt.track_id === t.id))

  const renderTrackList = (sectionId: string | null) => {
    const tracks = playlistTracks
      .filter(pt => sectionId ? pt.section_id === sectionId : !pt.section_id)
      .sort((a, b) => a.position - b.position)

    return (
      <div className="space-y-1">
        <SortableContext items={tracks.map(pt => pt.id)} strategy={verticalListSortingStrategy}>
          {tracks.map(pt => (
            <SortableTrackRow
              key={pt.id}
              pt={pt}
              currentTrack={currentTrack}
              isPlaying={isPlaying}
              onPlay={handlePlay}
              onRemove={handleRemoveTrack}
              artworkUrl={pt.track?.id ? trackArtworkUrls[pt.track.id] : undefined}
            />
          ))}
        </SortableContext>
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

  // Droppable section zone component
  function DroppableSectionZone({ sectionId, children }: { sectionId: string | null, children: React.ReactNode }) {
    const { setNodeRef, isOver } = useDroppable({
      id: sectionId ? `section-drop-${sectionId}` : 'unsectioned-drop-zone',
    })
    return (
      <div ref={setNodeRef} className={`transition-colors ${isOver ? 'ring-2 ring-indigo-500 ring-inset' : ''}`}>
        {children}
      </div>
    )
  }

  // Library drop zone - accepts track drags (to remove from playlist) AND file drops (to upload)
  function LibraryDropZone({ children }: { children: React.ReactNode }) {
    const { setNodeRef, isOver } = useDroppable({ id: 'library-drop-zone' })

    return (
      <div
        ref={setNodeRef}
        onDrop={handleLibraryDrop}
        onDragOver={handleLibraryDragOver}
        onDragLeave={handleLibraryDragLeave}
        className={`flex-1 overflow-auto p-2 transition-colors ${
          isOver ? 'bg-red-900/20 ring-2 ring-red-500 ring-inset' :
          libraryDragOver ? 'bg-indigo-900/20 ring-2 ring-indigo-500 ring-inset' : ''
        }`}
      >
        {isOver && <p className="text-xs text-red-400 text-center py-2 mb-2">Drop to remove from playlist</p>}
        {libraryDragOver && !isOver && <p className="text-xs text-indigo-400 text-center py-2 mb-2">Drop audio files to upload</p>}
        {libraryUploading && <p className="text-xs text-indigo-400 text-center py-2 mb-2">Uploading...</p>}
        {children}
      </div>
    )
  }

  const activeTrack = activeTrackId ? playlistTracks.find(pt => pt.id === activeTrackId) : null
  const activeSection = activeSectionId ? sections.find(s => s.id === activeSectionId) : null

  if (loading) {
    return (
      <div className="flex justify-center items-center h-full">
        <Loader2 className="animate-spin text-zinc-500" size={24} />
      </div>
    )
  }

  if (!playlist) {
    return <div className="p-6 text-zinc-400">Playlist not found.</div>
  }

  return (
    <div className="flex flex-col h-full">
      {/* Panel Header */}
      <div className="p-4 border-b border-zinc-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={handleArtworkUpload}
            disabled={uploadingArtwork}
            className="relative w-12 h-12 rounded-lg bg-zinc-800 border border-zinc-700 hover:border-zinc-500 flex items-center justify-center overflow-hidden group transition-colors shrink-0"
          >
            {artworkUrl ? (
              <>
                <img src={artworkUrl} alt="" className="w-full h-full object-cover" onError={() => setArtworkUrl(null)} />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  <Pencil size={12} className="text-white" />
                </div>
              </>
            ) : uploadingArtwork ? (
              <Loader2 size={16} className="text-zinc-500 animate-spin" />
            ) : (
              <Music size={16} className="text-zinc-500 group-hover:text-zinc-300 transition-colors" />
            )}
          </button>
          <div className="min-w-0">
            {editingTitle ? (
              <div className="flex items-center gap-2">
                <input
                  value={titleDraft}
                  onChange={e => setTitleDraft(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSaveTitle()}
                  className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full"
                  autoFocus
                />
                <button onClick={handleSaveTitle} className="text-xs text-indigo-400 hover:text-indigo-300">Save</button>
                <button onClick={() => setEditingTitle(false)} className="text-xs text-zinc-500 hover:text-zinc-300">Cancel</button>
              </div>
            ) : (
              <h2
                className="font-semibold truncate cursor-pointer hover:text-zinc-300 transition-colors"
                onClick={() => { setTitleDraft(playlist.title); setEditingTitle(true) }}
              >
                {playlist.title}
              </h2>
            )}
            {editingClient ? (
              <div className="flex items-center gap-2 mt-1">
                <input
                  value={clientDraft}
                  onChange={e => setClientDraft(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSaveClient()}
                  placeholder="Client name"
                  className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 w-32"
                  autoFocus
                />
                <button onClick={handleSaveClient} className="text-xs text-indigo-400 hover:text-indigo-300">Save</button>
                <button onClick={() => setEditingClient(false)} className="text-xs text-zinc-500 hover:text-zinc-300">Cancel</button>
              </div>
            ) : (
              <p
                className="text-xs text-zinc-500 truncate cursor-pointer hover:text-zinc-400 transition-colors"
                onClick={() => { setClientDraft(playlist.client_name || ''); setEditingClient(true) }}
              >
                {playlist.client_name ? `For ${playlist.client_name}` : 'Click to add client'}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setShowLibrary(!showLibrary)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${showLibrary ? 'bg-indigo-600 text-white' : 'bg-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-700'}`}
          >
            <Library size={18} />
            Library
          </button>
          <button
            onClick={() => setShowShare(true)}
            className="flex items-center gap-2 px-3 py-2 bg-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-700 rounded-lg text-sm font-medium transition-colors"
          >
            <Share2 size={18} />
            Share
          </button>
          <button
            onClick={handleDeletePlaylist}
            className="flex items-center gap-2 px-3 py-2 bg-zinc-800 text-zinc-300 hover:text-red-400 hover:bg-zinc-800/80 rounded-lg text-sm font-medium transition-colors"
          >
            <Trash2 size={18} />
            Delete
          </button>
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors ml-1"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Description */}
      <div className="px-4 py-2 border-b border-zinc-800">
        {editingDescription ? (
          <div className="space-y-2">
            <textarea
              value={descriptionDraft}
              onChange={e => setDescriptionDraft(e.target.value)}
              placeholder="Add a description..."
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              rows={2}
              autoFocus
            />
            <div className="flex gap-2">
              <button onClick={handleSaveDescription} className="text-xs text-indigo-400 hover:text-indigo-300">Save</button>
              <button onClick={() => setEditingDescription(false)} className="text-xs text-zinc-500 hover:text-zinc-300">Cancel</button>
            </div>
          </div>
        ) : (
          <p
            className="text-xs text-zinc-500 cursor-pointer hover:text-zinc-400 transition-colors"
            onClick={() => { setDescriptionDraft(playlist.description || ''); setEditingDescription(true) }}
          >
            {playlist.description || 'Click to add description...'}
          </p>
        )}
      </div>

      {/* Panel Content */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex flex-1 overflow-hidden">
          <div className="flex-1 overflow-auto p-4">
            <div className="space-y-4">
            <SortableContext items={sections.map(s => `section-${s.id}`)} strategy={verticalListSortingStrategy}>
              {sections.map((section, index) => (
                <DroppableSectionZone key={section.id} sectionId={section.id}>
                  <SortableSection
                    section={section}
                    trackCount={playlistTracks.filter(pt => pt.section_id === section.id).length}
                    expanded={expandedSections.has(section.id)}
                    onToggle={() => toggleSection(section.id)}
                    onDelete={() => handleDeleteSection(section.id)}
                    onRename={(title, emoji) => handleRenameSection(section.id, title, emoji)}
                    onMoveUp={() => handleMoveSection(section.id, 'up')}
                    onMoveDown={() => handleMoveSection(section.id, 'down')}
                    isFirst={index === 0}
                    isLast={index === sections.length - 1}
                  >
                    {expandedSections.has(section.id) && (
                      <div className="px-4 py-2">
                        {renderTrackList(section.id)}
                      </div>
                    )}
                  </SortableSection>
                </DroppableSectionZone>
              ))}
            </SortableContext>

            {playlistTracks.some(pt => !pt.section_id) && (
              <DroppableSectionZone sectionId={null}>
                <div className="border border-zinc-800 rounded-lg overflow-hidden">
                  <div className="flex items-center gap-3 px-4 py-3 bg-zinc-900">
                    {editingUnsectioned ? (
                      <div className="flex items-center gap-2 flex-1">
                        <input
                          value={unsectionedDraft}
                          onChange={e => setUnsectionedDraft(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              const trimmed = unsectionedDraft.trim() || 'Unsectioned'
                              if (trimmed !== 'Unsectioned') {
                                handleConvertToSection(trimmed)
                              }
                              setEditingUnsectioned(false)
                            }
                            if (e.key === 'Escape') setEditingUnsectioned(false)
                          }}
                          placeholder="Enter section name..."
                          className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          autoFocus
                        />
                        <button
                          onClick={() => {
                            const trimmed = unsectionedDraft.trim() || 'Unsectioned'
                            if (trimmed !== 'Unsectioned') {
                              handleConvertToSection(trimmed)
                            }
                            setEditingUnsectioned(false)
                          }}
                          className="text-xs text-indigo-400 hover:text-indigo-300 font-medium"
                        >
                          {unsectionedDraft.trim() && unsectionedDraft.trim() !== 'Unsectioned' ? 'Convert to Section' : 'Save'}
                        </button>
                        <button
                          onClick={() => setEditingUnsectioned(false)}
                          className="text-xs text-zinc-500 hover:text-zinc-300"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <>
                        <span className="text-sm text-zinc-400 flex-1">{unsectionedLabel}</span>
                        <button
                          onClick={() => {
                            setUnsectionedDraft('')
                            setEditingUnsectioned(true)
                          }}
                          className="text-zinc-400 hover:text-indigo-400 p-1 rounded hover:bg-zinc-700/50 transition-colors"
                          title="Convert to section"
                        >
                          <Pencil size={14} />
                        </button>
                      </>
                    )}
                  </div>
                  <div className="px-4 py-2">
                    {renderTrackList(null)}
                  </div>
                </div>
              </DroppableSectionZone>
            )}

          {showAddSection ? (
            <form onSubmit={handleAddSection} className="border border-zinc-700 rounded-lg p-4 space-y-3">
              <div className="flex gap-3">
                <input
                  value={newSectionEmoji}
                  onChange={e => setNewSectionEmoji(e.target.value)}
                  placeholder="Emoji"
                  className="w-14 bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-2 text-center text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <input
                  value={newSectionTitle}
                  onChange={e => setNewSectionTitle(e.target.value)}
                  placeholder="Section title"
                  required
                  className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
        </div>

          {/* Track Library Sidebar */}
          {showLibrary && (
            <div className="w-64 bg-zinc-900 border-l border-zinc-800 flex flex-col shrink-0">
          <div className="flex items-center justify-between p-3 border-b border-zinc-800">
            <h3 className="font-semibold text-sm">Library</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  const input = document.createElement('input')
                  input.type = 'file'
                  input.multiple = true
                  input.accept = 'audio/*'
                  input.onchange = () => {
                    if (input.files?.length) handleLibraryUpload(input.files)
                  }
                  input.click()
                }}
                disabled={libraryUploading}
                className="text-zinc-400 hover:text-indigo-400 disabled:opacity-50"
                title="Upload tracks"
              >
                <Upload size={16} />
              </button>
              <button onClick={() => setShowLibrary(false)} className="text-zinc-400 hover:text-white">
                <X size={16} />
              </button>
            </div>
          </div>

          {sections.length > 0 && (
            <div className="px-3 py-2 border-b border-zinc-800">
              <select
                key={sections.map(s => `${s.id}-${s.title}`).join(',')}
                value={libraryTarget ?? ''}
                onChange={e => setLibraryTarget(e.target.value || null)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">{unsectionedLabel}</option>
                {sections.map(sec => (
                  <option key={sec.id} value={sec.id}>
                    {sec.emoji ? `${sec.emoji} ` : ''}{sec.title}
                  </option>
                ))}
              </select>
            </div>
          )}

          <LibraryDropZone>
            {availableTracks.length === 0 ? (
              <p className="text-xs text-zinc-500 p-2 text-center">All tracks in playlist.</p>
            ) : (
              availableTracks.map(track => (
                <div
                  key={track.id}
                  className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-zinc-800 transition-colors group"
                >
                  <Music size={12} className="text-zinc-500 shrink-0" />
                  <span className="flex-1 text-xs truncate">{track.title}</span>
                  <button
                    onClick={() => handleAddTrackFromLibrary(track.id)}
                    className="flex items-center justify-center w-6 h-6 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white shrink-0 transition-colors"
                    title="Add to playlist"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              ))
            )}
            <p className="text-xs text-zinc-500 text-center mt-4 px-2 py-3 border border-dashed border-zinc-700 rounded-lg mx-1">
              Drag & drop audio files here to upload
            </p>
            </LibraryDropZone>
          </div>
          )}
        </div>

        {/* Drag Overlay */}
      <DragOverlay>
        {activeTrack && (
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-zinc-800 border border-indigo-500 shadow-xl">
            <GripVertical size={16} className="text-zinc-500" />
            <div className="w-9 h-9 rounded-md bg-zinc-700 flex items-center justify-center shrink-0">
              <Music size={14} className="text-zinc-500" />
            </div>
            <span className="text-sm">{activeTrack.track?.title}</span>
          </div>
        )}
        {activeSection && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-zinc-800 border border-indigo-500 shadow-xl">
            <GripVertical size={16} className="text-zinc-500" />
            <span className="text-base">
              {activeSection.emoji && <span className="mr-2">{activeSection.emoji}</span>}
              <span className="font-medium">{activeSection.title}</span>
            </span>
          </div>
        )}
      </DragOverlay>
      </DndContext>

      {showShare && (
        <ShareDialog playlistId={playlistId} onClose={() => setShowShare(false)} />
      )}
    </div>
  )
}

// ─── Main Playlists Page ───
export default function PlaylistsPage() {
  const { user } = useAuth()
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [title, setTitle] = useState('')
  const [clientName, setClientName] = useState('')
  const [creating, setCreating] = useState(false)
  const [duplicating, setDuplicating] = useState<string | null>(null)
  const [artworkUrls, setArtworkUrls] = useState<Record<string, string>>({})
  const [selectedPlaylist, setSelectedPlaylist] = useState<string | null>(null)

  useEffect(() => {
    listPlaylists().then(async (pls) => {
      setPlaylists(pls)
      const artworkMap: Record<string, string> = {}
      await Promise.all(
        pls.filter(p => p.artwork_path).map(async (p) => {
          try {
            artworkMap[p.id] = await getArtworkUrl(p.artwork_path!)
          } catch {}
        })
      )
      setArtworkUrls(artworkMap)
    }).finally(() => setLoading(false))
  }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !title.trim()) return
    setCreating(true)
    try {
      const pl = await createPlaylist(title.trim(), clientName.trim() || null, null, user.id)
      setPlaylists(prev => [pl, ...prev])
      setSelectedPlaylist(pl.id)
      setShowCreate(false)
      setTitle('')
      setClientName('')
    } finally {
      setCreating(false)
    }
  }

  const handleDuplicate = async (e: React.MouseEvent, playlistId: string) => {
    e.stopPropagation()
    if (!user) return
    setDuplicating(playlistId)
    try {
      const newPl = await duplicatePlaylist(playlistId, user.id)
      setPlaylists(prev => [newPl, ...prev])
      setSelectedPlaylist(newPl.id)
    } finally {
      setDuplicating(null)
    }
  }

  const handlePlaylistDeleted = (id: string) => {
    setPlaylists(prev => prev.filter(p => p.id !== id))
    setSelectedPlaylist(null)
  }

  return (
    <div className="flex h-full">
      {/* Playlists List */}
      <div className={`${selectedPlaylist ? 'w-80' : 'flex-1 max-w-2xl'} border-r border-zinc-800 flex flex-col transition-all shrink-0`}>
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between shrink-0">
          <h1 className="text-lg font-bold">Playlists</h1>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
          >
            <Plus size={14} />
            New
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="animate-spin text-zinc-500" size={24} />
          </div>
        ) : playlists.length === 0 ? (
          <div className="text-center py-20 px-4">
            <ListMusic className="mx-auto mb-3 text-zinc-600" size={40} />
            <p className="text-zinc-400 text-sm">No playlists yet</p>
          </div>
        ) : (
          <div className="flex-1 overflow-auto">
            {playlists.map(pl => (
              <div
                key={pl.id}
                onClick={() => setSelectedPlaylist(pl.id)}
                className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors group border-b border-zinc-800/50 ${
                  selectedPlaylist === pl.id
                    ? 'bg-zinc-800/70'
                    : 'hover:bg-zinc-800/30'
                }`}
              >
                {/* Artwork */}
                <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center shrink-0 overflow-hidden">
                  {artworkUrls[pl.id] ? (
                    <img src={artworkUrls[pl.id]} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Music size={16} className="text-zinc-600" />
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-sm truncate">{pl.title}</h3>
                  <p className="text-xs text-zinc-500 truncate">
                    {pl.client_name ? `For ${pl.client_name}` : 'No client'}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <button
                    onClick={(e) => handleDuplicate(e, pl.id)}
                    disabled={duplicating === pl.id}
                    className="p-1.5 rounded-md hover:bg-zinc-700 text-zinc-500 hover:text-white disabled:opacity-50"
                    title="Duplicate"
                  >
                    {duplicating === pl.id ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Copy size={12} />
                    )}
                  </button>
                  <button
                    onClick={async (e) => {
                      e.stopPropagation()
                      if (!confirm(`Delete "${pl.title}"?`)) return
                      await deletePlaylist(pl.id)
                      setPlaylists(prev => prev.filter(p => p.id !== pl.id))
                      if (selectedPlaylist === pl.id) setSelectedPlaylist(null)
                    }}
                    className="p-1.5 rounded-md hover:bg-zinc-700 text-zinc-500 hover:text-red-400"
                    title="Delete"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Playlist Detail Panel */}
      {selectedPlaylist ? (
        <div className="flex-1 relative">
          <PlaylistDetailPanel
            key={selectedPlaylist}
            playlistId={selectedPlaylist}
            onClose={() => setSelectedPlaylist(null)}
            onPlaylistDeleted={handlePlaylistDeleted}
          />
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-zinc-500">
          <div className="text-center">
            <ListMusic size={48} className="mx-auto mb-3 text-zinc-700" />
            <p className="text-sm">Select a playlist to view details</p>
          </div>
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-sm p-6">
            <h2 className="text-lg font-semibold mb-4">New Playlist</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm text-zinc-300 mb-1">Title</label>
                <input
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  required
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="e.g. Marvel Studios Pitch"
                />
              </div>
              <div>
                <label className="block text-sm text-zinc-300 mb-1">Client Name (optional)</label>
                <input
                  value={clientName}
                  onChange={e => setClientName(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="e.g. Marvel Studios"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white py-2 rounded-lg text-sm transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  {creating ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
