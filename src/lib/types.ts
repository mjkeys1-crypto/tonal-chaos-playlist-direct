export interface Profile {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  created_at: string
}

export interface Track {
  id: string
  title: string
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
  duration: number | null
  format: string | null
  file_size: number | null
  file_url: string | null
  storage_path: string | null
  artwork_path: string | null
  waveform_data: number[] | null
  owner_id: string
  created_at: string
}

export interface Playlist {
  id: string
  title: string
  description: string | null
  client_name: string | null
  artwork_path: string | null
  owner_id: string
  created_at: string
  updated_at: string
}

export interface Section {
  id: string
  playlist_id: string
  title: string
  emoji: string | null
  position: number
  is_expanded: boolean
  created_at: string
}

export interface PlaylistTrack {
  id: string
  playlist_id: string
  section_id: string | null
  track_id: string
  position: number
  created_at: string
  track?: Track
}

export interface Share {
  id: string
  playlist_id: string
  slug: string
  label: string | null
  access_mode: 'link' | 'email_verified'
  password_hash: string | null
  allow_download: boolean
  expires_at: string | null
  is_active: boolean
  created_at: string
  playlist?: Playlist
}

export interface ShareRecipient {
  id: string
  share_id: string
  email: string
  verification_code: string | null
  verified_at: string | null
  created_at: string
}

export interface PlayEvent {
  id: string
  track_id: string
  share_id: string
  listener_email: string | null
  listener_ip: string | null
  duration_listened: number
  completed: boolean
  user_agent: string | null
  country: string | null
  city: string | null
  device_type: string | null
  created_at: string
  updated_at: string
}

export interface DownloadEvent {
  id: string
  track_id: string
  share_id: string
  listener_email: string | null
  listener_ip: string | null
  user_agent: string | null
  country: string | null
  city: string | null
  device_type: string | null
  created_at: string
}
