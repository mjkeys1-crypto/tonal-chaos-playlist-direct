import { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { BarChart3, Loader2, Eye, Play, Download, Check, X as XIcon } from 'lucide-react'
import { getOverviewStats, getPageViews, getRecentPlays, getRecentDownloads } from '../lib/api/analytics'

type Tab = 'views' | 'plays' | 'downloads'

interface VisitorActivity {
  email: string | null
  shareLabel: string
  shareSlug: string
  shareId: string
  playlistId: string | null
  playlistTitle: string | null
  visitedAt: string
  played: boolean
  downloaded: boolean
  playCount: number
  downloadCount: number
  playedTracks: string[]
  downloadedTracks: string[]
}

export default function AnalyticsPage() {
  const [tab, setTab] = useState<Tab>('views')
  const [stats, setStats] = useState({ tracks: 0, playlists: 0, activeShares: 0, totalPlays: 0, totalDownloads: 0 })
  const [views, setViews] = useState<any[]>([])
  const [plays, setPlays] = useState<any[]>([])
  const [downloads, setDownloads] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [totalViews, setTotalViews] = useState(0)

  useEffect(() => {
    Promise.all([
      getOverviewStats(),
      getPageViews(100),
      getRecentPlays(100),
      getRecentDownloads(100),
    ]).then(([s, v, p, d]) => {
      setStats(s)
      setViews(v)
      setTotalViews(v.length)
      setPlays(p)
      setDownloads(d)
    }).finally(() => setLoading(false))
  }, [])

  // Aggregate visitor activity - combine views with play/download status
  const visitorActivity = useMemo<VisitorActivity[]>(() => {
    // Build lookup of emails by share_id from plays/downloads
    const emailsByShareId = new Map<string, Set<string>>()
    for (const p of plays) {
      if (p.share_id && p.listener_email) {
        if (!emailsByShareId.has(p.share_id)) emailsByShareId.set(p.share_id, new Set())
        emailsByShareId.get(p.share_id)!.add(p.listener_email)
      }
    }
    for (const d of downloads) {
      if (d.share_id && d.listener_email) {
        if (!emailsByShareId.has(d.share_id)) emailsByShareId.set(d.share_id, new Set())
        emailsByShareId.get(d.share_id)!.add(d.listener_email)
      }
    }

    // Group plays by share_id + email, collecting track titles
    const playsByVisitor = new Map<string, { count: number; tracks: string[] }>()
    for (const p of plays) {
      const key = `${p.share_id || 'none'}_${p.listener_email || 'anonymous'}`
      const existing = playsByVisitor.get(key) || { count: 0, tracks: [] }
      existing.count++
      const trackTitle = (p.track as any)?.title
      if (trackTitle && !existing.tracks.includes(trackTitle)) {
        existing.tracks.push(trackTitle)
      }
      playsByVisitor.set(key, existing)
    }

    // Group downloads by share_id + email, collecting track titles
    const downloadsByVisitor = new Map<string, { count: number; tracks: string[] }>()
    for (const d of downloads) {
      const key = `${d.share_id || 'none'}_${d.listener_email || 'anonymous'}`
      const existing = downloadsByVisitor.get(key) || { count: 0, tracks: [] }
      existing.count++
      const trackTitle = (d.track as any)?.title
      if (trackTitle && !existing.tracks.includes(trackTitle)) {
        existing.tracks.push(trackTitle)
      }
      downloadsByVisitor.set(key, existing)
    }

    // Build unified activity from views, deduplicating by visitor (email + share)
    // Keep only the most recent view per visitor/share combination
    const visitorMap = new Map<string, VisitorActivity>()

    for (const v of views) {
      const shareId = v.share_link_id || 'none'
      // Get email from page_view metadata, or fallback to emails found in plays/downloads for this share
      let email = v.metadata?.listener_email || null
      if (!email && shareId !== 'none') {
        const shareEmails = emailsByShareId.get(shareId)
        if (shareEmails && shareEmails.size === 1) {
          // If there's exactly one email for this share, use it
          email = Array.from(shareEmails)[0]
        }
      }

      const key = `${shareId}_${email || 'anonymous'}`
      const playData = playsByVisitor.get(key) || { count: 0, tracks: [] }
      const downloadData = downloadsByVisitor.get(key) || { count: 0, tracks: [] }

      const activity: VisitorActivity = {
        email,
        shareLabel: v.share_link?.label || v.share_link?.slug || '—',
        shareSlug: v.share_link?.slug || '',
        shareId,
        playlistId: v.share_link?.playlist_id || null,
        playlistTitle: v.share_link?.playlist?.title || null,
        visitedAt: v.created_at,
        played: playData.count > 0,
        downloaded: downloadData.count > 0,
        playCount: playData.count,
        downloadCount: downloadData.count,
        playedTracks: playData.tracks,
        downloadedTracks: downloadData.tracks,
      }

      // Only keep the most recent view for each visitor/share combination
      // Views are already sorted by created_at desc, so first occurrence wins
      if (!visitorMap.has(key)) {
        visitorMap.set(key, activity)
      }
    }

    return Array.from(visitorMap.values())
  }, [views, plays, downloads])

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-zinc-500" size={24} />
      </div>
    )
  }

  const tabs: { key: Tab; label: string; icon: typeof Eye; count: number }[] = [
    { key: 'views', label: 'Views', icon: Eye, count: totalViews },
    { key: 'plays', label: 'Plays', icon: Play, count: stats.totalPlays },
    { key: 'downloads', label: 'Downloads', icon: Download, count: stats.totalDownloads },
  ]

  const formatDate = (d: string) => new Date(d).toLocaleString()
  const getShareLabel = (row: any) => row.share_link?.label || row.share_link?.slug || '—'

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">Analytics</h1>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {tabs.map(({ key, label, icon: Icon, count }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`bg-zinc-900 border rounded-lg p-5 text-left transition-colors ${
              tab === key ? 'border-indigo-500' : 'border-zinc-800 hover:border-zinc-700'
            }`}
          >
            <Icon size={20} className={tab === key ? 'text-indigo-400 mb-3' : 'text-zinc-500 mb-3'} />
            <p className="text-2xl font-bold">{count}</p>
            <p className="text-sm text-zinc-500 mt-1">{label}</p>
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'views' && (
        visitorActivity.length === 0 ? (
          <EmptyState message="No page views recorded yet." />
        ) : (
          <div className="border border-zinc-800 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="text-xs text-zinc-500 uppercase tracking-wider border-b border-zinc-800">
                  <th className="px-4 py-3 text-left">Visitor</th>
                  <th className="px-4 py-3 text-left">Share Link</th>
                  <th className="px-4 py-3 text-center">Played</th>
                  <th className="px-4 py-3 text-center">Downloaded</th>
                  <th className="px-4 py-3 text-left">When</th>
                </tr>
              </thead>
              <tbody>
                {visitorActivity.map((v, i) => (
                  <tr key={i} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                    <td className="px-4 py-2.5 text-sm">
                      {v.email ? (
                        <span className="text-indigo-400">{v.email}</span>
                      ) : (
                        <span className="text-zinc-600">Anonymous</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-sm truncate max-w-xs">
                      {v.playlistId ? (
                        <Link to={`/playlists/${v.playlistId}`} className="text-indigo-400 hover:text-indigo-300 hover:underline">
                          {v.shareLabel}
                        </Link>
                      ) : (
                        v.shareLabel
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      {v.played ? (
                        <span className="relative group inline-flex items-center gap-1 text-green-400 text-xs cursor-help">
                          <Check size={14} />
                          {v.playCount > 1 && <span>({v.playCount})</span>}
                          {v.playedTracks.length > 0 && (
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-opacity duration-100 z-50 whitespace-nowrap text-left">
                              <p className="text-zinc-400 text-[10px] uppercase tracking-wide mb-1">Played</p>
                              {v.playedTracks.map((t, idx) => (
                                <p key={idx} className="text-zinc-200 text-xs">{t}</p>
                              ))}
                              <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-zinc-700" />
                            </div>
                          )}
                        </span>
                      ) : (
                        <XIcon size={14} className="mx-auto text-zinc-700" />
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      {v.downloaded ? (
                        <span className="relative group inline-flex items-center gap-1 text-green-400 text-xs cursor-help">
                          <Check size={14} />
                          {v.downloadCount > 1 && <span>({v.downloadCount})</span>}
                          {v.downloadedTracks.length > 0 && (
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-opacity duration-100 z-50 whitespace-nowrap text-left">
                              <p className="text-zinc-400 text-[10px] uppercase tracking-wide mb-1">Downloaded</p>
                              {v.downloadedTracks.map((t, idx) => (
                                <p key={idx} className="text-zinc-200 text-xs">{t}</p>
                              ))}
                              <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-zinc-700" />
                            </div>
                          )}
                        </span>
                      ) : (
                        <XIcon size={14} className="mx-auto text-zinc-700" />
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-sm text-zinc-500">{formatDate(v.visitedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {tab === 'plays' && (
        plays.length === 0 ? (
          <EmptyState message="No plays recorded yet." />
        ) : (
          <Table
            headers={['Track', 'Listener', 'Share Link', 'When']}
            rows={plays.map(p => [
              (p.track as any)?.title || 'Unknown',
              p.listener_email || '—',
              getShareLabel(p),
              formatDate(p.created_at),
            ])}
          />
        )
      )}

      {tab === 'downloads' && (
        downloads.length === 0 ? (
          <EmptyState message="No downloads recorded yet." />
        ) : (
          <Table
            headers={['Track', 'Listener', 'Share Link', 'When']}
            rows={downloads.map(d => [
              (d.track as any)?.title || 'Unknown',
              d.listener_email || '—',
              getShareLabel(d),
              formatDate(d.created_at),
            ])}
          />
        )
      )}
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="text-center py-16">
      <BarChart3 className="mx-auto mb-3 text-zinc-600" size={40} />
      <p className="text-zinc-400">{message}</p>
    </div>
  )
}

function Table({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="border border-zinc-800 rounded-lg overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="text-xs text-zinc-500 uppercase tracking-wider border-b border-zinc-800">
            {headers.map(h => (
              <th key={h} className="px-4 py-3 text-left">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
              {row.map((cell, j) => (
                <td key={j} className="px-4 py-2.5 text-sm truncate max-w-xs">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
