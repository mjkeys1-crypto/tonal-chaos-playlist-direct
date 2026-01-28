import { supabase } from '../supabase'
import type { Track } from '../types'
import { parseBlob } from 'music-metadata-browser'

export async function listTracks(): Promise<Track[]> {
  const { data, error } = await supabase
    .from('tracks')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

interface ExtractedMetadata {
  title: string | null
  artist: string | null
  album: string | null
  year: number | null
  genre: string | null
  composer: string | null
  bpm: number | null
  key: string | null
  isrc: string | null
  copyright: string | null
  comment: string | null
  artworkBlob: Blob | null
}

async function extractMetadata(file: File): Promise<ExtractedMetadata> {
  try {
    console.log('[extractMetadata] Parsing file:', file.name, file.type)
    const metadata = await parseBlob(file)
    const common = metadata.common
    console.log('[extractMetadata] Found metadata:', {
      title: common.title,
      artist: common.artist,
      album: common.album,
      year: common.year,
      genre: common.genre,
      composer: common.composer,
      bpm: common.bpm,
      key: common.key,
      isrc: common.isrc,
      hasPicture: !!common.picture?.length
    })

    let artworkBlob: Blob | null = null
    if (common.picture && common.picture.length > 0) {
      const pic = common.picture[0]
      const mimeType = pic.format || 'image/jpeg'
      // Convert Buffer to Uint8Array for Blob compatibility
      const uint8Array = new Uint8Array(pic.data)
      artworkBlob = new Blob([uint8Array], { type: mimeType })
      console.log('[extractMetadata] Extracted artwork:', mimeType, artworkBlob.size, 'bytes')
    }

    return {
      title: common.title || null,
      artist: common.artist || null,
      album: common.album || null,
      year: common.year || null,
      genre: common.genre?.join(', ') || null,
      composer: common.composer?.join(', ') || null,
      bpm: common.bpm || null,
      key: common.key || null,
      isrc: common.isrc?.[0] || null,
      copyright: common.copyright || null,
      comment: common.comment?.join(' ') || null,
      artworkBlob,
    }
  } catch (err) {
    console.error('[extractMetadata] Error:', err)
    return {
      title: null, artist: null, album: null, year: null, genre: null,
      composer: null, bpm: null, key: null, isrc: null, copyright: null,
      comment: null, artworkBlob: null
    }
  }
}

export async function uploadTrack(file: File, userId: string): Promise<Track> {
  const ext = file.name.split('.').pop()?.toLowerCase()
  const trackId = crypto.randomUUID()
  const storagePath = `${userId}/${trackId}.${ext}`

  console.log('[uploadTrack] Starting upload:', file.name, 'type:', file.type, 'size:', file.size)

  // Extract embedded metadata (artwork, artist, title)
  const metadata = await extractMetadata(file)
  console.log('[uploadTrack] Metadata extracted:', { title: metadata.title, artist: metadata.artist, hasArtwork: !!metadata.artworkBlob })

  // Upload audio file to storage
  const { error: uploadError } = await supabase.storage
    .from('tracks')
    .upload(storagePath, file)
  if (uploadError) throw uploadError

  // Upload artwork if embedded
  let artworkPath: string | null = null
  if (metadata.artworkBlob) {
    const artExt = metadata.artworkBlob.type.split('/')[1] || 'jpg'
    artworkPath = `track-artwork/${trackId}.${artExt}`
    console.log('[uploadTrack] Uploading artwork to:', artworkPath)
    const { error: artworkError } = await supabase.storage
      .from('tracks')
      .upload(artworkPath, metadata.artworkBlob, { upsert: true })
    if (artworkError) {
      console.error('[uploadTrack] Artwork upload error:', artworkError)
      artworkPath = null
    } else {
      console.log('[uploadTrack] Artwork uploaded successfully')
    }
  }

  // Get duration client-side
  const duration = await getAudioDuration(file)

  // Use extracted title or fall back to filename
  const title = metadata.title || file.name.replace(/\.[^.]+$/, '')

  // Insert track record
  console.log('[uploadTrack] Inserting track with artwork_path:', artworkPath)
  const { data, error } = await supabase
    .from('tracks')
    .insert({
      title,
      artist: metadata.artist,
      album: metadata.album,
      year: metadata.year,
      genre: metadata.genre,
      composer: metadata.composer,
      bpm: metadata.bpm,
      key: metadata.key,
      isrc: metadata.isrc,
      copyright: metadata.copyright,
      comment: metadata.comment,
      storage_path: storagePath,
      file_url: storagePath,
      format: ext,
      file_size: file.size,
      duration,
      artwork_path: artworkPath,
      owner_id: userId,
    })
    .select()
    .single()
  if (error) {
    console.error('[uploadTrack] Insert error:', error)
    throw error
  }
  console.log('[uploadTrack] Track created:', data.id, 'artwork_path:', data.artwork_path)
  return data
}

export async function deleteTrack(id: string, storagePath: string | null, artworkPath?: string | null) {
  console.log('[deleteTrack] Deleting track:', id)

  // First, remove any playlist_tracks references
  const { error: ptError } = await supabase
    .from('playlist_tracks')
    .delete()
    .eq('track_id', id)
  console.log('[deleteTrack] Playlist tracks delete error:', ptError)
  // Don't throw on ptError - might not have any playlist_tracks

  // Delete from storage
  if (storagePath) {
    const { error: storageError } = await supabase.storage.from('tracks').remove([storagePath])
    console.log('[deleteTrack] Storage delete:', storagePath, storageError)
  }

  // Delete artwork from storage if exists
  if (artworkPath) {
    const { error: artworkError } = await supabase.storage.from('tracks').remove([artworkPath])
    console.log('[deleteTrack] Artwork delete:', artworkPath, artworkError)
  }

  // Delete track record
  const { error } = await supabase
    .from('tracks')
    .delete()
    .eq('id', id)
  console.log('[deleteTrack] Track delete error:', error)

  if (error) throw new Error(`Delete failed: ${error.message} (code: ${error.code})`)

  // Verify deletion
  const { data: check } = await supabase.from('tracks').select('id').eq('id', id).single()
  if (check) {
    throw new Error('Track still exists after delete - RLS policy blocking deletion. Check Supabase policies.')
  }
}

export async function getSignedUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from('tracks')
    .createSignedUrl(storagePath, 3600)
  if (error) throw error
  return data.signedUrl
}

export async function getTrackArtworkUrl(artworkPath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from('tracks')
    .createSignedUrl(artworkPath, 3600)
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
