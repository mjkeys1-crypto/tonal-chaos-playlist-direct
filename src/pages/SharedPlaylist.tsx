import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { Play, Pause, Download, ChevronDown, ChevronRight, Loader2, Lock, FolderDown, Music, Info, X, Mail } from 'lucide-react'
import WaveSurfer from 'wavesurfer.js'
import JSZip from 'jszip'
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
  require_email: boolean
  recipient_email: string | null
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

  // Email gate
  const [needsEmail, setNeedsEmail] = useState(false)
  const [emailInput, setEmailInput] = useState('')
  const [listenerEmail, setListenerEmail] = useState<string | null>(null)

  // Player
  const [playingTrack, setPlayingTrack] = useState<Track | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const wsRef = useRef<WaveSurfer | null>(null)
  const waveContainerRef = useRef<HTMLDivElement | null>(null)
  const [playingUrl, setPlayingUrl] = useState<string | null>(null)
  const [containerReady, setContainerReady] = useState(false)
  const [zipping, setZipping] = useState(false)
  const [zipProgress, setZipProgress] = useState('')
  const [artworkUrls, setArtworkUrls] = useState<Record<string, string>>({})
  const [playingArtwork, setPlayingArtwork] = useState<string | null>(null)
  const [infoTrack, setInfoTrack] = useState<Track | null>(null)

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

      // If recipient_email is pre-set, use it for tracking (skip email gate)
      if (data.recipient_email) {
        setListenerEmail(data.recipient_email)
        await loadPlaylistData(data, data.recipient_email)
        return
      }

      if (data.require_email) {
        setShare(data)
        setNeedsEmail(true)
        setLoading(false)
        return
      }

      await loadPlaylistData(data)
    } catch (err: any) {
      setError(err.message || 'Something went wrong')
      setLoading(false)
    }
  }

  const loadPlaylistData = async (shareData: ShareData, email?: string) => {
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

    // Load artwork URLs for tracks that have embedded artwork
    const tracks = (pts.data || []).map(pt => pt.track).filter(Boolean) as Track[]
    const artworkMap: Record<string, string> = {}
    await Promise.all(
      tracks.filter(t => t.artwork_path).map(async (t) => {
        try {
          const { data } = await supabase.storage.from('tracks').createSignedUrl(t.artwork_path!, 3600)
          if (data) artworkMap[t.id] = data.signedUrl
        } catch {}
      })
    )
    setArtworkUrls(artworkMap)

    // Log page view
    supabase.from('analytics_events').insert({
      event_type: 'page_view',
      share_link_id: shareData.id,
      metadata: { user_agent: navigator.userAgent, listener_email: email || null },
    }).then(() => {})
  }

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!share) return
    if (passwordInput !== share.password_hash) {
      setPasswordError('Incorrect password')
      return
    }
    setNeedsPassword(false)

    // If recipient_email is pre-set, use it for tracking
    if (share.recipient_email) {
      setListenerEmail(share.recipient_email)
      setLoading(true)
      await loadPlaylistData(share, share.recipient_email)
      return
    }

    // After password, check if email is also required
    if (share.require_email) {
      setNeedsEmail(true)
      return
    }
    setLoading(true)
    await loadPlaylistData(share)
  }

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!share || !emailInput.trim()) return
    const email = emailInput.trim()
    setListenerEmail(email)
    setNeedsEmail(false)
    setLoading(true)
    await loadPlaylistData(share, email)
  }

  const destroyWaveSurfer = useCallback(() => {
    if (wsRef.current) {
      try {
        wsRef.current.pause()
        wsRef.current.destroy()
      } catch (e) {
        console.error('Error destroying WaveSurfer:', e)
      }
      wsRef.current = null
    }
  }, [])

  const initWaveSurfer = useCallback((url: string) => {
    if (!waveContainerRef.current) return

    // Always destroy existing instance first
    destroyWaveSurfer()

    const ws = WaveSurfer.create({
      container: waveContainerRef.current,
      url,
      waveColor: 'rgba(255,255,255,0.15)',
      progressColor: '#818cf8',
      cursorColor: '#a5b4fc',
      cursorWidth: 1,
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      height: 36,
      normalize: true,
      interact: true,
    })

    wsRef.current = ws
    ws.on('ready', () => {
      setDuration(ws.getDuration())
      ws.play().catch(() => {})
    })
    ws.on('timeupdate', (t: number) => setCurrentTime(t))
    ws.on('finish', () => {
      setIsPlaying(false)
      setPlayingTrack(null)
      setPlayingUrl(null)
      setPlayingArtwork(null)
    })
    ws.on('play', () => setIsPlaying(true))
    ws.on('pause', () => setIsPlaying(false))
  }, [destroyWaveSurfer])

  // Callback ref - just store the ref and signal when ready
  const setWaveContainer = useCallback((node: HTMLDivElement | null) => {
    waveContainerRef.current = node
    setContainerReady(!!node)
  }, [])

  // Single initialization point - when both URL and container are ready
  useEffect(() => {
    if (playingUrl && containerReady && waveContainerRef.current) {
      initWaveSurfer(playingUrl)
    }
  }, [playingUrl, containerReady, initWaveSurfer])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      destroyWaveSurfer()
    }
  }, [destroyWaveSurfer])

  const handlePlay = async (track: Track) => {
    if (playingTrack?.id === track.id) {
      const ws = wsRef.current
      if (!ws) return
      if (isPlaying) {
        ws.pause()
      } else {
        ws.play().catch(() => {})
      }
      return
    }

    // Stop current track before switching
    destroyWaveSurfer()

    const path = track.storage_path || track.file_url
    if (!path) return

    const { data } = await supabase.storage.from('tracks').createSignedUrl(path, 3600)
    if (!data) return

    setPlayingTrack(track)
    setIsPlaying(true)
    setPlayingUrl(data.signedUrl)
    setPlayingArtwork(artworkUrls[track.id] || null)

    supabase.from('play_events').insert({
      track_id: track.id,
      share_id: share?.id,
      listener_email: listenerEmail,
      user_agent: navigator.userAgent,
    }).then(() => {})
  }

  const handleDownload = async (track: Track) => {
    const path = track.storage_path || track.file_url
    if (!path) return
    const { data } = await supabase.storage.from('tracks').createSignedUrl(path, 300)
    if (!data) return

    const res = await fetch(data.signedUrl)
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${track.title}.${track.format || 'wav'}`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 10000)

    supabase.from('download_events').insert({
      track_id: track.id,
      share_id: share?.id,
      listener_email: listenerEmail,
      user_agent: navigator.userAgent,
    }).then(() => {})
  }

  const handleDownloadAll = async () => {
    const tracks = playlistTracks.map(pt => pt.track).filter(Boolean) as Track[]
    if (tracks.length === 0) return
    setZipping(true)
    try {
      const zip = new JSZip()
      for (let i = 0; i < tracks.length; i++) {
        const track = tracks[i]
        setZipProgress(`Downloading ${i + 1} of ${tracks.length}...`)
        const path = track.storage_path || track.file_url
        if (!path) continue
        const { data } = await supabase.storage.from('tracks').createSignedUrl(path, 300)
        if (!data) continue
        const res = await fetch(data.signedUrl)
        const blob = await res.blob()
        zip.file(`${track.title}.${track.format || 'wav'}`, blob)
      }
      setZipProgress('Building ZIP...')
      const content = await zip.generateAsync({ type: 'blob' })
      const url = URL.createObjectURL(content)
      const a = document.createElement('a')
      a.href = url
      a.download = `${share!.playlist.title}.zip`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 10000)
    } finally {
      setZipping(false)
      setZipProgress('')
    }
  }

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev)
      next.has(sectionId) ? next.delete(sectionId) : next.add(sectionId)
      return next
    })
  }

  // (WaveSurfer handles seek, time, and duration)

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

  if (needsEmail) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4 relative">
        <AnimatedOrbs />
        <div className="w-full max-w-sm text-center relative z-10">
          <img src="/logo.png" alt="Tonal Chaos" className="w-20 h-20 mx-auto mb-6 object-contain" />
          <Mail className="mx-auto mb-4 text-zinc-500" size={32} />
          <h1 className="text-xl font-bold text-white mb-2">Enter Your Email</h1>
          <p className="text-sm text-zinc-400 mb-6">Please enter your email to access this playlist.</p>
          <form onSubmit={handleEmailSubmit} className="space-y-4">
            <input
              type="email"
              value={emailInput}
              onChange={e => setEmailInput(e.target.value)}
              placeholder="you@example.com"
              className="w-full bg-zinc-900/80 border border-zinc-700/50 rounded-xl px-4 py-3 text-white text-center focus:outline-none focus:ring-2 focus:ring-indigo-500 backdrop-blur-sm"
              autoFocus
              required
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
      className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
        playingTrack?.id === track.id
          ? 'bg-white/[0.07] shadow-lg shadow-indigo-500/5'
          : 'hover:bg-white/[0.03]'
      }`}
    >
      {/* Thumbnail with play overlay */}
      <button
        onClick={() => handlePlay(track)}
        className="relative w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center shrink-0 group overflow-hidden"
      >
        {artworkUrls[track.id] ? (
          <img src={artworkUrls[track.id]} alt="" className="w-full h-full object-cover" />
        ) : (
          <Music size={16} className="text-zinc-600" />
        )}
        <div className={`absolute inset-0 flex items-center justify-center transition-opacity ${
          playingTrack?.id === track.id
            ? 'opacity-100 bg-indigo-500/80'
            : 'opacity-0 group-hover:opacity-100 bg-black/60'
        }`}>
          {playingTrack?.id === track.id && isPlaying
            ? <Pause size={14} className="text-white" />
            : <Play size={14} className="text-white ml-0.5" />
          }
        </div>
      </button>
      <span className="text-xs text-zinc-600 tabular-nums w-5 text-right shrink-0">{index + 1}</span>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium truncate ${
          playingTrack?.id === track.id ? 'text-indigo-300' : 'text-white'
        }`}>{track.title}</p>
        {track.artist && <p className="text-xs text-zinc-500">{track.artist}</p>}
      </div>
      <span className="text-xs text-zinc-600 tabular-nums">{formatDuration(track.duration)}</span>
      <button
        onClick={() => setInfoTrack(track)}
        className="text-zinc-600 hover:text-white transition-colors"
        title="Track info"
      >
        <Info size={15} />
      </button>
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

      {/* Hero Header */}
      <header className="relative overflow-hidden border-b border-zinc-800/50">
        <AnimatedOrbs />
        <div className="relative z-10 max-w-2xl mx-auto px-6 pt-10 pb-8">
          <div className="flex items-center gap-3 mb-6">
            <img src="/logo.png" alt="Tonal Chaos" className="w-10 h-10 object-contain" />
            <span className="text-xs uppercase tracking-[0.25em] font-semibold bg-gradient-to-r from-zinc-200 via-blue-300 to-indigo-400 bg-clip-text text-transparent" style={{ fontFamily: 'Rajdhani, sans-serif' }}>Tonal Chaos</span>
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
            {share!.allow_download && (
              <>
                <span className="w-1 h-1 bg-zinc-700 rounded-full" />
                <button
                  onClick={handleDownloadAll}
                  disabled={zipping}
                  className="flex items-center gap-2 text-xs text-indigo-400 hover:text-indigo-300 transition-colors disabled:opacity-50"
                >
                  {zipping ? (
                    <><Loader2 size={12} className="animate-spin" /> {zipProgress}</>
                  ) : (
                    <><FolderDown size={13} /> Download All</>
                  )}
                </button>
              </>
            )}
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
        <span style={{ fontFamily: 'Rajdhani, sans-serif' }}>Shared via Tonal Chaos</span>
      </footer>

      {/* Now Playing Bar */}
      {playingTrack && (
        <div className="fixed bottom-0 left-0 right-0 bg-zinc-900/95 backdrop-blur-xl border-t border-zinc-800/50 shadow-2xl shadow-black/50">
          <div className="max-w-2xl mx-auto px-6 pt-3 pb-2">
            {/* Top row: thumbnail, play button, title, time */}
            <div className="flex items-center gap-3 mb-2">
              {/* Thumbnail */}
              <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center shrink-0 overflow-hidden">
                {playingArtwork ? (
                  <img src={playingArtwork} alt="" className="w-full h-full object-cover" />
                ) : (
                  <Music size={16} className="text-zinc-600" />
                )}
              </div>
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
            {/* Full-width waveform */}
            <div ref={setWaveContainer} className="w-full" />
          </div>
        </div>
      )}

      {/* Track Info Modal */}
      {infoTrack && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setInfoTrack(null)}>
          <div className="bg-zinc-900 border border-zinc-700/50 rounded-2xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-zinc-800">
              <h3 className="font-semibold text-white">Track Info</h3>
              <button onClick={() => setInfoTrack(null)} className="text-zinc-400 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="p-4 space-y-3">
              {/* Artwork and Title */}
              <div className="flex items-center gap-4 pb-3 border-b border-zinc-800">
                <div className="w-16 h-16 rounded-lg bg-zinc-800 flex items-center justify-center overflow-hidden shrink-0">
                  {artworkUrls[infoTrack.id] ? (
                    <img src={artworkUrls[infoTrack.id]} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Music size={24} className="text-zinc-600" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-white truncate">{infoTrack.title}</p>
                  {infoTrack.artist && <p className="text-sm text-zinc-400">{infoTrack.artist}</p>}
                </div>
              </div>

              {/* Metadata Grid */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                {infoTrack.album && (
                  <div>
                    <p className="text-zinc-500 text-xs uppercase tracking-wide mb-0.5">Album</p>
                    <p className="text-zinc-200">{infoTrack.album}</p>
                  </div>
                )}
                {infoTrack.year && (
                  <div>
                    <p className="text-zinc-500 text-xs uppercase tracking-wide mb-0.5">Year</p>
                    <p className="text-zinc-200">{infoTrack.year}</p>
                  </div>
                )}
                {infoTrack.genre && (
                  <div>
                    <p className="text-zinc-500 text-xs uppercase tracking-wide mb-0.5">Genre</p>
                    <p className="text-zinc-200">{infoTrack.genre}</p>
                  </div>
                )}
                {infoTrack.composer && (
                  <div>
                    <p className="text-zinc-500 text-xs uppercase tracking-wide mb-0.5">Composer</p>
                    <p className="text-zinc-200">{infoTrack.composer}</p>
                  </div>
                )}
                {infoTrack.publisher && (
                  <div>
                    <p className="text-zinc-500 text-xs uppercase tracking-wide mb-0.5">Publisher</p>
                    <p className="text-zinc-200">{infoTrack.publisher}</p>
                  </div>
                )}
                {infoTrack.bpm && (
                  <div>
                    <p className="text-zinc-500 text-xs uppercase tracking-wide mb-0.5">BPM</p>
                    <p className="text-zinc-200">{infoTrack.bpm}</p>
                  </div>
                )}
                {infoTrack.key && (
                  <div>
                    <p className="text-zinc-500 text-xs uppercase tracking-wide mb-0.5">Key</p>
                    <p className="text-zinc-200">{infoTrack.key}</p>
                  </div>
                )}
                {infoTrack.isrc && (
                  <div>
                    <p className="text-zinc-500 text-xs uppercase tracking-wide mb-0.5">ISRC</p>
                    <p className="text-zinc-200 font-mono text-xs">{infoTrack.isrc}</p>
                  </div>
                )}
                {infoTrack.copyright && (
                  <div className="col-span-2">
                    <p className="text-zinc-500 text-xs uppercase tracking-wide mb-0.5">Copyright</p>
                    <p className="text-zinc-200 text-xs">{infoTrack.copyright}</p>
                  </div>
                )}
                {infoTrack.duration && (
                  <div>
                    <p className="text-zinc-500 text-xs uppercase tracking-wide mb-0.5">Duration</p>
                    <p className="text-zinc-200">{formatDuration(infoTrack.duration)}</p>
                  </div>
                )}
                {infoTrack.format && (
                  <div>
                    <p className="text-zinc-500 text-xs uppercase tracking-wide mb-0.5">Format</p>
                    <p className="text-zinc-200 uppercase">{infoTrack.format}</p>
                  </div>
                )}
              </div>

              {infoTrack.comment && (
                <div className="pt-3 border-t border-zinc-800">
                  <p className="text-zinc-500 text-xs uppercase tracking-wide mb-1">Notes</p>
                  <p className="text-zinc-300 text-sm">{infoTrack.comment}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
