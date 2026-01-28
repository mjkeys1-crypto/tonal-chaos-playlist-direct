import { supabase } from '../supabase'
import type { Share } from '../types'

export async function listSharesForPlaylist(playlistId: string): Promise<Share[]> {
  const { data, error } = await supabase
    .from('share_links')
    .select('*')
    .eq('playlist_id', playlistId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function createShare(playlistId: string, opts: {
  label: string
  allowDownload?: boolean
  passwordHash?: string | null
  expiresAt?: string | null
}): Promise<Share> {
  const slug = crypto.randomUUID().replace(/-/g, '').slice(0, 12)
  const { data, error } = await supabase
    .from('share_links')
    .insert({
      playlist_id: playlistId,
      slug,
      label: opts.label,
      allow_download: opts.allowDownload ?? false,
      password_hash: opts.passwordHash ?? null,
      expires_at: opts.expiresAt ?? null,
      is_active: true,
      access_mode: 'link',
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteShare(id: string) {
  const { error } = await supabase.from('share_links').delete().eq('id', id)
  if (error) throw error
}

export async function toggleShareActive(id: string, isActive: boolean) {
  const { error } = await supabase.from('share_links').update({ is_active: isActive }).eq('id', id)
  if (error) throw error
}

export async function getShareByToken(token: string): Promise<Share & { playlist: any }> {
  const { data, error } = await supabase
    .from('share_links')
    .select('*, playlist:playlists(*)')
    .eq('slug', token)
    .eq('is_active', true)
    .single()
  if (error) throw error
  // Check expiration
  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    throw new Error('This link has expired')
  }
  return data
}
