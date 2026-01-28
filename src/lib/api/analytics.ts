import { supabase } from '../supabase'

export async function getOverviewStats() {
  const [tracks, playlists, shares, plays, downloads] = await Promise.all([
    supabase.from('tracks').select('id', { count: 'exact', head: true }),
    supabase.from('playlists').select('id', { count: 'exact', head: true }),
    supabase.from('share_links').select('id', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('play_events').select('id', { count: 'exact', head: true }),
    supabase.from('download_events').select('id', { count: 'exact', head: true }),
  ])
  return {
    tracks: tracks.count || 0,
    playlists: playlists.count || 0,
    activeShares: shares.count || 0,
    totalPlays: plays.count || 0,
    totalDownloads: downloads.count || 0,
  }
}

export async function getRecentPlays(limit = 50) {
  const { data, error } = await supabase
    .from('play_events')
    .select('*, track:tracks(title), share_link:share_links(slug, label)')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data
}

export async function getPlaysByTrack() {
  const { data, error } = await supabase
    .from('play_events')
    .select('track_id, track:tracks(title)')
  if (error) throw error

  // Count plays per track
  const counts: Record<string, { title: string; count: number }> = {}
  for (const row of data || []) {
    const id = row.track_id
    if (!counts[id]) {
      counts[id] = { title: (row.track as any)?.title || 'Unknown', count: 0 }
    }
    counts[id].count++
  }
  return Object.entries(counts)
    .map(([id, { title, count }]) => ({ id, title, count }))
    .sort((a, b) => b.count - a.count)
}

export async function getPageViews(limit = 50) {
  const { data, error } = await supabase
    .from('analytics_events')
    .select('*, share_link:share_links(slug, label, playlist_id, playlist:playlists(title))')
    .eq('event_type', 'page_view')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data
}

export async function getRecentDownloads(limit = 50) {
  const { data, error } = await supabase
    .from('download_events')
    .select('*, track:tracks(title), share_link:share_links(slug, label)')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data
}

export async function getShareAnalytics(shareId: string) {
  const [plays, downloads] = await Promise.all([
    supabase.from('play_events').select('*, track:tracks(title)').eq('share_id', shareId).order('created_at', { ascending: false }),
    supabase.from('download_events').select('*, track:tracks(title)').eq('share_id', shareId).order('created_at', { ascending: false }),
  ])
  return {
    plays: plays.data || [],
    downloads: downloads.data || [],
  }
}
