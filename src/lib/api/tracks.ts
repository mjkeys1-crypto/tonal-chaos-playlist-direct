import { supabase } from '../supabase'
import type { Track } from '../types'

export async function listTracks(): Promise<Track[]> {
  const { data, error } = await supabase
    .from('tracks')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function uploadTrack(file: File, userId: string): Promise<Track> {
  const ext = file.name.split('.').pop()
  const storagePath = `${userId}/${crypto.randomUUID()}.${ext}`

  // Upload to storage
  const { error: uploadError } = await supabase.storage
    .from('tracks')
    .upload(storagePath, file)
  if (uploadError) throw uploadError

  // Get duration client-side
  const duration = await getAudioDuration(file)

  // Insert track record
  const { data, error } = await supabase
    .from('tracks')
    .insert({
      title: file.name.replace(/\.[^.]+$/, ''),
      storage_path: storagePath,
      file_url: storagePath,
      format: ext,
      file_size: file.size,
      duration,
      owner_id: userId,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteTrack(id: string, storagePath: string | null) {
  if (storagePath) {
    await supabase.storage.from('tracks').remove([storagePath])
  }
  const { error } = await supabase.from('tracks').delete().eq('id', id)
  if (error) throw error
}

export async function getSignedUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from('tracks')
    .createSignedUrl(storagePath, 3600)
  if (error) throw error
  return data.signedUrl
}

function getAudioDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const audio = new Audio()
    audio.addEventListener('loadedmetadata', () => {
      resolve(Math.round(audio.duration))
      URL.revokeObjectURL(audio.src)
    })
    audio.addEventListener('error', () => {
      resolve(null)
      URL.revokeObjectURL(audio.src)
    })
    audio.src = URL.createObjectURL(file)
  })
}
