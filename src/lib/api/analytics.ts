import { supabase } from '../supabase'

export async function getOverviewStats() {
  const [tracks, playlists, shares, plays, downloads] = await Promise.all([
    supabase.from('pd_tracks').select('id', { count: 'exact', head: true }),
    supabase.from('pd_playlists').select('id', { count: 'exact', head: true }),
    supabase.from('pd_share_links').select('id', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('pd_play_events').select('id', { count: 'exact', head: true }),
    supabase.from('pd_download_events').select('id', { count: 'exact', head: true }),
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
    .from('pd_play_events')
    .select('*, track:pd_tracks(title), share_link:pd_share_links(slug, label)')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data
}

export async function getPlaysByTrack() {
  const { data, error } = await supabase
    .from('pd_play_events')
    .select('track_id, track:pd_tracks(title)')
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
    .from('pd_analytics_events')
    .select('*, share_link:pd_share_links(slug, label, playlist_id, playlist:pd_playlists(title))')
    .eq('event_type', 'page_view')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data
}

export async function getRecentDownloads(limit = 50) {
  const { data, error } = await supabase
    .from('pd_download_events')
    .select('*, track:pd_tracks(title), share_link:pd_share_links(slug, label)')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data
}

export async function getShareAnalytics(shareId: string) {
  const [plays, downloads] = await Promise.all([
    supabase.from('pd_play_events').select('*, track:pd_tracks(title)').eq('share_id', shareId).order('created_at', { ascending: false }),
    supabase.from('pd_download_events').select('*, track:pd_tracks(title)').eq('share_id', shareId).order('created_at', { ascending: false }),
  ])
  return {
    plays: plays.data || [],
    downloads: downloads.data || [],
  }
}

export interface ActivityNotification {
  id: string
  type: 'view' | 'play' | 'download'
  email: string | null
  trackTitle?: string
  shareLabel: string
  playlistTitle?: string
  timestamp: string
}

export async function getRecentActivity(limit = 20): Promise<ActivityNotification[]> {
  const [views, plays, downloads] = await Promise.all([
    supabase
      .from('pd_analytics_events')
      .select('id, created_at, metadata, share_link:pd_share_links(slug, label, playlist:pd_playlists(title))')
      .eq('event_type', 'page_view')
      .order('created_at', { ascending: false })
      .limit(limit),
    supabase
      .from('pd_play_events')
      .select('id, created_at, listener_email, track:pd_tracks(title), share_link:pd_share_links(slug, label)')
      .order('created_at', { ascending: false })
      .limit(limit),
    supabase
      .from('pd_download_events')
      .select('id, created_at, listener_email, track:pd_tracks(title), share_link:pd_share_links(slug, label)')
      .order('created_at', { ascending: false })
      .limit(limit),
  ])

  const activities: ActivityNotification[] = []

  for (const v of views.data || []) {
    activities.push({
      id: `view-${v.id}`,
      type: 'view',
      email: (v.metadata as any)?.listener_email || null,
      shareLabel: (v.share_link as any)?.label || (v.share_link as any)?.slug || 'Unknown',
      playlistTitle: (v.share_link as any)?.playlist?.title,
      timestamp: v.created_at,
    })
  }

  for (const p of plays.data || []) {
    activities.push({
      id: `play-${p.id}`,
      type: 'play',
      email: p.listener_email,
      trackTitle: (p.track as any)?.title,
      shareLabel: (p.share_link as any)?.label || (p.share_link as any)?.slug || 'Unknown',
      timestamp: p.created_at,
    })
  }

  for (const d of downloads.data || []) {
    activities.push({
      id: `download-${d.id}`,
      type: 'download',
      email: d.listener_email,
      trackTitle: (d.track as any)?.title,
      shareLabel: (d.share_link as any)?.label || (d.share_link as any)?.slug || 'Unknown',
      timestamp: d.created_at,
    })
  }

  // Sort by timestamp descending
  activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

  return activities.slice(0, limit)
}
