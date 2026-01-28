import { supabase } from '../supabase'
import type { Playlist, Section, PlaylistTrack } from '../types'

export async function listPlaylists(): Promise<Playlist[]> {
  const { data, error } = await supabase
    .from('playlists')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function getPlaylist(id: string): Promise<Playlist> {
  const { data, error } = await supabase
    .from('playlists')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export async function createPlaylist(title: string, clientName: string | null, description: string | null, ownerId: string): Promise<Playlist> {
  const { data, error } = await supabase
    .from('playlists')
    .insert({ title, client_name: clientName, description, owner_id: ownerId })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updatePlaylist(id: string, updates: Partial<Pick<Playlist, 'title' | 'description' | 'client_name'>>) {
  const { error } = await supabase.from('playlists').update(updates).eq('id', id)
  if (error) throw error
}

export async function deletePlaylist(id: string) {
  const { error } = await supabase.from('playlists').delete().eq('id', id)
  if (error) throw error
}

// Sections
export async function listSections(playlistId: string): Promise<Section[]> {
  const { data, error } = await supabase
    .from('sections')
    .select('*')
    .eq('playlist_id', playlistId)
    .order('position')
  if (error) throw error
  return data
}

export async function createSection(playlistId: string, title: string, emoji: string | null, position: number): Promise<Section> {
  const { data, error } = await supabase
    .from('sections')
    .insert({ playlist_id: playlistId, title, emoji, position })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateSection(id: string, updates: Partial<Pick<Section, 'title' | 'emoji' | 'position'>>) {
  const { error } = await supabase.from('sections').update(updates).eq('id', id)
  if (error) throw error
}

export async function deleteSection(id: string) {
  const { error } = await supabase.from('sections').delete().eq('id', id)
  if (error) throw error
}

// Playlist tracks
export async function listPlaylistTracks(playlistId: string): Promise<PlaylistTrack[]> {
  const { data, error } = await supabase
    .from('playlist_tracks')
    .select('*, track:tracks(*)')
    .eq('playlist_id', playlistId)
    .order('position')
  if (error) throw error
  return data
}

export async function addTrackToPlaylist(playlistId: string, trackId: string, sectionId: string | null, position: number) {
  const { error } = await supabase
    .from('playlist_tracks')
    .insert({ playlist_id: playlistId, track_id: trackId, section_id: sectionId, position })
  if (error) throw error
}

export async function removeTrackFromPlaylist(id: string) {
  const { error } = await supabase.from('playlist_tracks').delete().eq('id', id)
  if (error) throw error
}

export async function reorderPlaylistTracks(items: { id: string; position: number; section_id: string | null }[]) {
  for (const item of items) {
    await supabase
      .from('playlist_tracks')
      .update({ position: item.position, section_id: item.section_id })
      .eq('id', item.id)
  }
}

export async function addTracksToPlaylist(playlistId: string, trackIds: string[], sectionId: string | null) {
  let startPos = 0
  if (sectionId) {
    const { data: sectionTracks } = await supabase
      .from('playlist_tracks')
      .select('position')
      .eq('playlist_id', playlistId)
      .eq('section_id', sectionId)
      .order('position', { ascending: false })
      .limit(1)
    startPos = sectionTracks?.[0]?.position != null ? sectionTracks[0].position + 1 : 0
  } else {
    const { data: unsectioned } = await supabase
      .from('playlist_tracks')
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

  const { error } = await supabase.from('playlist_tracks').insert(rows)
  if (error) throw error
}
