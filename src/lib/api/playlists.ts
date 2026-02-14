import { supabase } from '../supabase'
import type { Playlist, Section, PlaylistTrack } from '../types'

export async function listPlaylists(): Promise<Playlist[]> {
  const { data, error } = await supabase
    .from('pd_playlists')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function getPlaylist(id: string): Promise<Playlist> {
  const { data, error } = await supabase
    .from('pd_playlists')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export async function createPlaylist(title: string, clientName: string | null, description: string | null, ownerId: string): Promise<Playlist> {
  const { data, error } = await supabase
    .from('pd_playlists')
    .insert({ title, client_name: clientName, description, owner_id: ownerId })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updatePlaylist(id: string, updates: Partial<Pick<Playlist, 'title' | 'description' | 'client_name' | 'artwork_path'>>) {
  const { error } = await supabase.from('pd_playlists').update(updates).eq('id', id)
  if (error) throw error
}

export async function uploadPlaylistArtwork(playlistId: string, file: File): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const path = `playlist-artwork/${playlistId}.${ext}`

  // Upload to storage
  const { error: uploadError } = await supabase.storage
    .from('pd-tracks')
    .upload(path, file, { upsert: true })
  if (uploadError) throw uploadError

  // Update playlist with artwork path
  await updatePlaylist(playlistId, { artwork_path: path })

  return path
}

export async function getArtworkUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from('pd-tracks').createSignedUrl(path, 3600)
  if (error) throw error
  return data.signedUrl
}

export async function deletePlaylist(id: string) {
  console.log('[deletePlaylist] Starting delete for:', id)

  // Delete related data first (but NOT the actual tracks)
  // Delete share links and their related analytics
  const { data: shares } = await supabase.from('pd_share_links').select('id').eq('playlist_id', id)
  if (shares && shares.length > 0) {
    const shareIds = shares.map(s => s.id)
    console.log('[deletePlaylist] Deleting analytics for shares:', shareIds)
    await supabase.from('pd_analytics_events').delete().in('share_link_id', shareIds)
    await supabase.from('pd_play_events').delete().in('share_id', shareIds)
    await supabase.from('pd_download_events').delete().in('share_id', shareIds)
    await supabase.from('pd_share_recipients').delete().in('share_id', shareIds)
    await supabase.from('pd_share_links').delete().eq('playlist_id', id)
  }

  // Delete sections and playlist_tracks
  console.log('[deletePlaylist] Deleting playlist_tracks and sections')
  await supabase.from('pd_playlist_tracks').delete().eq('playlist_id', id)
  await supabase.from('pd_sections').delete().eq('playlist_id', id)

  // Delete playlist artwork from storage if exists
  const { data: playlist } = await supabase.from('pd_playlists').select('artwork_path').eq('id', id).single()
  if (playlist?.artwork_path) {
    await supabase.storage.from('pd-tracks').remove([playlist.artwork_path])
  }

  // Finally delete the playlist
  console.log('[deletePlaylist] Deleting playlist record')
  const { error, count } = await supabase
    .from('pd_playlists')
    .delete({ count: 'exact' })
    .eq('id', id)

  console.log('[deletePlaylist] Result - count:', count, 'error:', error)
  if (error) throw error
  if (count === 0) {
    throw new Error('Playlist deletion failed - check RLS policies in Supabase')
  }
}

// Get playlists that contain specific tracks
export async function getPlaylistsContainingTracks(trackIds: string[]): Promise<{ trackId: string, playlistTitle: string }[]> {
  const { data, error } = await supabase
    .from('pd_playlist_tracks')
    .select('track_id, playlist:pd_playlists(title)')
    .in('track_id', trackIds)
  if (error) throw error

  return (data || []).map(pt => ({
    trackId: pt.track_id,
    playlistTitle: (pt.playlist as any)?.title || 'Unknown'
  }))
}

export async function duplicatePlaylist(id: string, ownerId: string): Promise<Playlist> {
  // Get original playlist
  const original = await getPlaylist(id)

  // Create new playlist with (Copy) suffix
  const { data: newPlaylist, error: plError } = await supabase
    .from('pd_playlists')
    .insert({
      title: `${original.title} (Copy)`,
      client_name: original.client_name,
      description: original.description,
      owner_id: ownerId,
    })
    .select()
    .single()
  if (plError) throw plError

  // Get original sections and create mapping
  const originalSections = await listSections(id)
  const sectionMap = new Map<string, string>()

  for (const sec of originalSections) {
    const { data: newSec, error: secError } = await supabase
      .from('pd_sections')
      .insert({
        playlist_id: newPlaylist.id,
        title: sec.title,
        emoji: sec.emoji,
        position: sec.position,
      })
      .select()
      .single()
    if (secError) throw secError
    sectionMap.set(sec.id, newSec.id)
  }

  // Get original tracks and copy them
  const originalTracks = await listPlaylistTracks(id)
  if (originalTracks.length > 0) {
    const newTracks = originalTracks.map(pt => ({
      playlist_id: newPlaylist.id,
      track_id: pt.track_id,
      section_id: pt.section_id ? sectionMap.get(pt.section_id) || null : null,
      position: pt.position,
    }))
    const { error: trackError } = await supabase.from('pd_playlist_tracks').insert(newTracks)
    if (trackError) throw trackError
  }

  return newPlaylist
}

// Sections
export async function listSections(playlistId: string): Promise<Section[]> {
  const { data, error } = await supabase
    .from('pd_sections')
    .select('*')
    .eq('playlist_id', playlistId)
    .order('position')
  if (error) throw error
  return data
}

export async function createSection(playlistId: string, title: string, emoji: string | null, position: number): Promise<Section> {
  const { data, error } = await supabase
    .from('pd_sections')
    .insert({ playlist_id: playlistId, title, emoji, position })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateSection(id: string, updates: Partial<Pick<Section, 'title' | 'emoji' | 'position'>>) {
  const { error } = await supabase.from('pd_sections').update(updates).eq('id', id)
  if (error) throw error
}

export async function deleteSection(id: string) {
  const { error } = await supabase.from('pd_sections').delete().eq('id', id)
  if (error) throw error
}

// Playlist tracks
export async function listPlaylistTracks(playlistId: string): Promise<PlaylistTrack[]> {
  const { data, error } = await supabase
    .from('pd_playlist_tracks')
    .select('*, track:pd_tracks(*)')
    .eq('playlist_id', playlistId)
    .order('position')
  if (error) throw error
  return data
}

export async function addTrackToPlaylist(playlistId: string, trackId: string, sectionId: string | null, position: number) {
  const { error } = await supabase
    .from('pd_playlist_tracks')
    .insert({ playlist_id: playlistId, track_id: trackId, section_id: sectionId, position })
  if (error) throw error
}

export async function removeTrackFromPlaylist(id: string) {
  const { error } = await supabase.from('pd_playlist_tracks').delete().eq('id', id)
  if (error) throw error
}

export async function reorderPlaylistTracks(items: { id: string; position: number; section_id: string | null }[]) {
  for (const item of items) {
    await supabase
      .from('pd_playlist_tracks')
      .update({ position: item.position, section_id: item.section_id })
      .eq('id', item.id)
  }
}

export async function addTracksToPlaylist(playlistId: string, trackIds: string[], sectionId: string | null) {
  let startPos = 0
  if (sectionId) {
    const { data: sectionTracks } = await supabase
      .from('pd_playlist_tracks')
      .select('position')
      .eq('playlist_id', playlistId)
      .eq('section_id', sectionId)
      .order('position', { ascending: false })
      .limit(1)
    startPos = sectionTracks?.[0]?.position != null ? sectionTracks[0].position + 1 : 0
  } else {
    const { data: unsectioned } = await supabase
      .from('pd_playlist_tracks')
      .select('position')
      .eq('playlist_id', playlistId)
      .is('section_id', null)
      .order('position', { ascending: false })
      .limit(1)
    startPos = unsectioned?.[0]?.position != null ? unsectioned[0].position + 1 : 0
  }

  const rows = trackIds.map((trackId, i) => ({
    playlist_id: playlistId,
    track_id: trackId,
    section_id: sectionId,
    position: startPos + i,
  }))

  const { error } = await supabase.from('pd_playlist_tracks').insert(rows)
  if (error) throw error
}
