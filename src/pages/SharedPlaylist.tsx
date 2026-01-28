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

function AnimatedOrbs() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div className="absolute -top-20 -left-20 w-72 h-72 bg-blue-600/20 rounded-full blur-[100px] animate-[pulse_8s_ease-in-out_infinite]" />
      <div className="absolute -top-10 -right-20 w-60 h-60 bg-purple-600/20 rounded-full blur-[100px] animate-[pulse_6s_ease-in-out_infinite_1s]" />
      <div className="absolute top-10 left-1/3 w-40 h-40 bg-indigo-500/15 rounded-full blur-[80px] animate-[pulse_10s_ease-in-out_infinite_2s]" />
    </div>
  )
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

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !duration) return
    const rect = e.currentTarget.getBoundingClientRect()
    const pct = (e.clientX - rect.left) / rect.width
    audioRef.current.currentTime = pct * duration
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
          <img src="/logo.png" alt="Tonal Chaos" className="w-16 h-16 mx-auto mb-4 object-contain" />
          <p className="text-zinc-400 text-lg">{error}</p>
        </div>
      </div>
    )
  }

  if (needsPassword) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4 relative">
        <AnimatedOrbs />
        <div className="w-full max-w-sm text-center relative z-10">
          <img src="/logo.png" alt="Tonal Chaos" className="w-20 h-20 mx-auto mb-6 object-contain" />
          <Lock className="mx-auto mb-4 text-zinc-500" size={32} />
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
              className="w-full bg-zinc-900/80 border border-zinc-700/50 rounded-xl px-4 py-3 text-white text-center focus:outline-none focus:ring-2 focus:ring-indigo-500 backdrop-blur-sm"
              autoFocus
            />
            <button className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-3 rounded-xl transition-colors">
              Continue
            </button>
          </form>
        </div>
      </div>
    )
  }

  const playlist = share!.playlist
  const totalTracks = playlistTracks.length
  const totalDuration = playlistTracks.reduce((sum, pt) => sum + (pt.track?.duration || 0), 0)
  const totalMins = Math.floor(totalDuration / 60)

  const renderTrack = (track: Track, index: number) => (
    <div
      key={track.id}
      className={`flex items-center gap-4 px-4 py-3 rounded-xl transition-all ${
        playingTrack?.id === track.id
          ? 'bg-white/[0.07] shadow-lg shadow-indigo-500/5'
          : 'hover:bg-white/[0.03]'
      }`}
    >
      <button
        onClick={() => handlePlay(track)}
        className={`w-9 h-9 flex items-center justify-center rounded-full transition-all shrink-0 ${
          playingTrack?.id === track.id && isPlaying
            ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/30'
            : 'bg-white/10 hover:bg-white/20 text-white'
        }`}
      >
        {playingTrack?.id === track.id && isPlaying
          ? <Pause size={14} />
          : <Play size={14} className="ml-0.5" />
        }
      </button>
      <span className="text-xs text-zinc-600 tabular-nums w-6 text-right shrink-0">{index + 1}</span>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium truncate ${
          playingTrack?.id === track.id ? 'text-indigo-300' : 'text-white'
        }`}>{track.title}</p>
        {track.artist && <p className="text-xs text-zinc-500">{track.artist}</p>}
      </div>
      <span className="text-xs text-zinc-600 tabular-nums">{formatDuration(track.duration)}</span>
      {share!.allow_download && (
        <button
          onClick={() => handleDownload(track)}
          className="text-zinc-600 hover:text-white transition-colors"
          title="Download"
        >
          <Download size={15} />
        </button>
      )}
    </div>
  )

  return (
    <div className="min-h-screen bg-zinc-950">
      <audio ref={audioRef} />

      {/* Hero Header */}
      <header className="relative overflow-hidden border-b border-zinc-800/50">
        <AnimatedOrbs />
        <div className="relative z-10 max-w-2xl mx-auto px-6 pt-10 pb-8">
          <div className="flex items-center gap-3 mb-6">
            <img src="/logo.png" alt="Tonal Chaos" className="w-10 h-10 object-contain" />
            <span className="text-xs uppercase tracking-[0.25em] text-zinc-500 font-medium">Tonal Chaos</span>
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">
            {playlist.client_name ? `Music for ${playlist.client_name}` : playlist.title}
          </h1>
          {playlist.description && (
            <p className="text-sm text-zinc-400 mt-3 leading-relaxed">{playlist.description}</p>
          )}
          <div className="flex items-center gap-4 mt-5">
            <span className="text-xs text-zinc-500">{totalTracks} track{totalTracks !== 1 ? 's' : ''}</span>
            <span className="w-1 h-1 bg-zinc-700 rounded-full" />
            <span className="text-xs text-zinc-500">{totalMins} min</span>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-6 py-8 space-y-4">
        {sections.length > 0 ? (
          sections.map(section => {
            const sectionTracks = playlistTracks
              .filter(pt => pt.section_id === section.id)
              .sort((a, b) => a.position - b.position)
            if (sectionTracks.length === 0) return null
            return (
              <div key={section.id} className="border border-zinc-800/40 rounded-2xl overflow-hidden bg-zinc-900/30 backdrop-blur-sm">
                <button
                  onClick={() => toggleSection(section.id)}
                  className="w-full flex items-center gap-3 px-5 py-4 hover:bg-white/[0.02] transition-colors text-left"
                >
                  {expandedSections.has(section.id) ? <ChevronDown size={16} className="text-zinc-500" /> : <ChevronRight size={16} className="text-zinc-500" />}
                  <span className="text-base font-semibold">
                    {section.emoji && <span className="mr-2">{section.emoji}</span>}
                    {section.title}
                  </span>
                  <span className="text-xs text-zinc-600 ml-auto">{sectionTracks.length} track{sectionTracks.length !== 1 ? 's' : ''}</span>
                </button>
                {expandedSections.has(section.id) && (
                  <div className="px-2 pb-3">
                    {sectionTracks.map((pt, i) => pt.track && renderTrack(pt.track, i))}
                  </div>
                )}
              </div>
            )
          })
        ) : (
          <div className="space-y-1">
            {playlistTracks
              .sort((a, b) => a.position - b.position)
              .map((pt, i) => pt.track && renderTrack(pt.track, i))}
          </div>
        )}

        {/* Unsectioned tracks */}
        {sections.length > 0 && playlistTracks.some(pt => !pt.section_id) && (
          <div className="border border-zinc-800/40 rounded-2xl overflow-hidden bg-zinc-900/30 px-2 py-3">
            {playlistTracks
              .filter(pt => !pt.section_id)
              .sort((a, b) => a.position - b.position)
              .map((pt, i) => pt.track && renderTrack(pt.track, i))}
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className={`text-center py-8 text-xs text-zinc-700 ${playingTrack ? 'pb-24' : ''}`}>
        Shared via Tonal Chaos
      </footer>

      {/* Now Playing Bar */}
      {playingTrack && (
        <div className="fixed bottom-0 left-0 right-0 bg-zinc-900/95 backdrop-blur-xl border-t border-zinc-800/50 shadow-2xl shadow-black/50">
          {/* Progress bar */}
          <div
            onClick={handleSeek}
            className="h-1 bg-zinc-800 cursor-pointer group"
          >
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-200 relative"
              style={{ width: duration ? `${(currentTime / duration) * 100}%` : '0%' }}
            >
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg" />
            </div>
          </div>
          <div className="max-w-2xl mx-auto px-6 py-3 flex items-center gap-4">
            <button
              onClick={() => handlePlay(playingTrack)}
              className="w-9 h-9 flex items-center justify-center rounded-full bg-white text-zinc-900 hover:scale-105 transition-transform shrink-0"
            >
              {isPlaying ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
            </button>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{playingTrack.title}</p>
              {playingTrack.artist && <p className="text-xs text-zinc-500 truncate">{playingTrack.artist}</p>}
            </div>
            <span className="text-xs text-zinc-500 tabular-nums shrink-0">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
