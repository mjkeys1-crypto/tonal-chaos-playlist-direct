import { useEffect, useState, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { Play, Pause, Download, ChevronDown, ChevronRight, Loader2, Lock } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Playlist, Section, PlaylistTrack, Track } from '../lib/types'

function formatDuration(s: number | null) {
  if (!s) return '--:--'
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`
}

function formatTime(s: number) {
  return `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`
}

interface ShareData {
  id: string
  slug: string
  allow_download: boolean
  password_hash: string | null
  expires_at: string | null
  playlist: Playlist
}

export default function SharedPlaylist() {
  const { token } = useParams<{ token: string }>()
  const [share, setShare] = useState<ShareData | null>(null)
  const [sections, setSections] = useState<Section[]>([])
  const [playlistTracks, setPlaylistTracks] = useState<PlaylistTrack[]>([])
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Password gate
  const [needsPassword, setNeedsPassword] = useState(false)
  const [passwordInput, setPasswordInput] = useState('')
  const [passwordError, setPasswordError] = useState('')

  // Player
  const [playingTrack, setPlayingTrack] = useState<Track | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const audioRef = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    loadShare()
  }, [token])

  const loadShare = async () => {
    try {
      const { data, error: err } = await supabase
        .from('share_links')
        .select('*, playlist:playlists(*)')
        .eq('slug', token)
        .eq('is_active', true)
        .single()
      if (err || !data) throw new Error('Share link not found')
      if (data.expires_at && new Date(data.expires_at) < new Date()) throw new Error('This link has expired')

      if (data.password_hash) {
        setShare(data)
        setNeedsPassword(true)
        setLoading(false)
        return
      }

      await loadPlaylistData(data)
    } catch (err: any) {
      setError(err.message || 'Something went wrong')
      setLoading(false)
    }
  }

  const loadPlaylistData = async (shareData: ShareData) => {
    const playlistId = shareData.playlist.id
    const [secs, pts] = await Promise.all([
      supabase.from('sections').select('*').eq('playlist_id', playlistId).order('position'),
      supabase.from('playlist_tracks').select('*, track:tracks(*)').eq('playlist_id', playlistId).order('position'),
    ])
    setShare(shareData)
    setSections(secs.data || [])
    setPlaylistTracks(pts.data || [])
    setExpandedSections(new Set((secs.data || []).map((s: Section) => s.id)))
    setNeedsPassword(false)
    setLoading(false)

    // Log page view
    supabase.from('analytics_events').insert({
      event_type: 'page_view',
      share_link_id: shareData.id,
      metadata: { user_agent: navigator.userAgent },
    }).then(() => {})
  }

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!share) return
    // Simple password check (plain text comparison for v1)
    if (passwordInput !== share.password_hash) {
      setPasswordError('Incorrect password')
      return
    }
    setLoading(true)
    await loadPlaylistData(share)
  }

  const handlePlay = async (track: Track) => {
    if (playingTrack?.id === track.id) {
      if (isPlaying) {
        audioRef.current?.pause()
        setIsPlaying(false)
      } else {
        audioRef.current?.play()
        setIsPlaying(true)
      }
      return
    }

    const path = track.storage_path || track.file_url
    if (!path) return

    const { data } = await supabase.storage.from('tracks').createSignedUrl(path, 3600)
    if (!data) return

    setPlayingTrack(track)
    setIsPlaying(true)
    if (audioRef.current) {
      audioRef.current.src = data.signedUrl
      audioRef.current.play()
    }

    // Log play event
    supabase.from('play_events').insert({
      track_id: track.id,
      share_id: share?.id,
      user_agent: navigator.userAgent,
    }).then(() => {})
  }

  const handleDownload = async (track: Track) => {
    const path = track.storage_path || track.file_url
    if (!path) return
    const { data } = await supabase.storage.from('tracks').createSignedUrl(path, 300)
    if (!data) return
    const a = document.createElement('a')
    a.href = data.signedUrl
    a.download = `${track.title}.${track.format || 'wav'}`
    a.click()

    // Log download
    supabase.from('download_events').insert({
      track_id: track.id,
      share_id: share?.id,
      user_agent: navigator.userAgent,
    }).then(() => {})
  }

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev)
      next.has(sectionId) ? next.delete(sectionId) : next.add(sectionId)
      return next
    })
  }

  // Audio events
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    const onTime = () => setCurrentTime(audio.currentTime)
    const onDur = () => setDuration(audio.duration || 0)
    const onEnd = () => { setIsPlaying(false); setPlayingTrack(null) }
    audio.addEventListener('timeupdate', onTime)
    audio.addEventListener('loadedmetadata', onDur)
    audio.addEventListener('ended', onEnd)
    return () => {
      audio.removeEventListener('timeupdate', onTime)
      audio.removeEventListener('loadedmetadata', onDur)
      audio.removeEventListener('ended', onEnd)
    }
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Loader2 className="animate-spin text-zinc-500" size={32} />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-zinc-400 text-lg">{error}</p>
        </div>
      </div>
    )
  }

  if (needsPassword) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
        <div className="w-full max-w-sm text-center">
          <Lock className="mx-auto mb-4 text-zinc-500" size={40} />
          <h1 className="text-xl font-bold text-white mb-2">Password Required</h1>
          <p className="text-sm text-zinc-400 mb-6">This playlist is password protected.</p>
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            {passwordError && (
              <p className="text-sm text-red-400">{passwordError}</p>
            )}
            <input
              type="password"
              value={passwordInput}
              onChange={e => setPasswordInput(e.target.value)}
              placeholder="Enter password"
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 text-white text-center focus:outline-none focus:ring-2 focus:ring-indigo-500"
              autoFocus
            />
            <button className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-3 rounded-lg transition-colors">
              Continue
            </button>
          </form>
        </div>
      </div>
    )
  }

  const playlist = share!.playlist

  const renderTrack = (track: Track) => (
    <div
      key={track.id}
      className={`flex items-center gap-4 px-4 py-3 rounded-lg transition-colors ${
        playingTrack?.id === track.id ? 'bg-white/5' : 'hover:bg-white/[0.03]'
      }`}
    >
      <button
        onClick={() => handlePlay(track)}
        className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors shrink-0"
      >
        {playingTrack?.id === track.id && isPlaying
          ? <Pause size={14} />
          : <Play size={14} className="ml-0.5" />
        }
      </button>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate">{track.title}</p>
        {track.artist && <p className="text-xs text-zinc-500">{track.artist}</p>}
      </div>
      <span className="text-xs text-zinc-500 tabular-nums">{formatDuration(track.duration)}</span>
      {share!.allow_download && (
        <button
          onClick={() => handleDownload(track)}
          className="text-zinc-500 hover:text-white transition-colors"
        >
          <Download size={16} />
        </button>
      )}
    </div>
  )

  return (
    <div className="min-h-screen bg-zinc-950">
      <audio ref={audioRef} />

      {/* Header */}
      <header className="border-b border-zinc-800">
        <div className="max-w-2xl mx-auto px-6 py-6">
          <p className="text-xs uppercase tracking-widest text-zinc-500 mb-2">Tonal Chaos</p>
          <h1 className="text-2xl font-bold text-white">
            {playlist.client_name ? `Music for ${playlist.client_name}` : playlist.title}
          </h1>
          {playlist.description && (
            <p className="text-sm text-zinc-400 mt-2">{playlist.description}</p>
          )}
        </div>
      </header>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-6 py-6 space-y-4">
        {sections.length > 0 ? (
          sections.map(section => {
            const sectionTracks = playlistTracks
              .filter(pt => pt.section_id === section.id)
              .sort((a, b) => a.position - b.position)
            if (sectionTracks.length === 0) return null
            return (
              <div key={section.id} className="border border-zinc-800/60 rounded-xl overflow-hidden">
                <button
                  onClick={() => toggleSection(section.id)}
                  className="w-full flex items-center gap-3 px-5 py-4 hover:bg-white/[0.02] transition-colors text-left"
                >
                  {expandedSections.has(section.id) ? <ChevronDown size={16} className="text-zinc-500" /> : <ChevronRight size={16} className="text-zinc-500" />}
                  <span className="text-base font-medium">
                    {section.emoji && <span className="mr-2">{section.emoji}</span>}
                    {section.title}
                  </span>
                  <span className="text-xs text-zinc-600 ml-auto">{sectionTracks.length} tracks</span>
                </button>
                {expandedSections.has(section.id) && (
                  <div className="px-2 pb-2">
                    {sectionTracks.map(pt => pt.track && renderTrack(pt.track))}
                  </div>
                )}
              </div>
            )
          })
        ) : (
          // Flat track list (no sections)
          <div className="space-y-1">
            {playlistTracks
              .sort((a, b) => a.position - b.position)
              .map(pt => pt.track && renderTrack(pt.track))}
          </div>
        )}
      </div>

      {/* Now playing bar */}
      {playingTrack && (
        <div className="fixed bottom-0 left-0 right-0 bg-zinc-900/95 backdrop-blur border-t border-zinc-800">
          <div className="max-w-2xl mx-auto px-6 py-3 flex items-center gap-4">
            <button
              onClick={() => handlePlay(playingTrack)}
              className="text-white"
            >
              {isPlaying ? <Pause size={20} /> : <Play size={20} />}
            </button>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{playingTrack.title}</p>
            </div>
            <span className="text-xs text-zinc-500 tabular-nums">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
