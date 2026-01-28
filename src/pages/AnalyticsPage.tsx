import { useEffect, useState } from 'react'
import { BarChart3, Loader2, Eye, Play, Download } from 'lucide-react'
import { getOverviewStats, getPageViews, getRecentPlays, getRecentDownloads } from '../lib/api/analytics'

type Tab = 'views' | 'plays' | 'downloads'

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
        views.length === 0 ? (
          <EmptyState message="No page views recorded yet." />
        ) : (
          <Table
            headers={['Share Link', 'User Agent', 'When']}
            rows={views.map(v => [
              getShareLabel(v),
              truncateUA(v.metadata?.user_agent),
              formatDate(v.created_at),
            ])}
          />
        )
      )}

      {tab === 'plays' && (
        plays.length === 0 ? (
          <EmptyState message="No plays recorded yet." />
        ) : (
          <Table
            headers={['Track', 'Share Link', 'User Agent', 'When']}
            rows={plays.map(p => [
              (p.track as any)?.title || 'Unknown',
              getShareLabel(p),
              truncateUA(p.user_agent),
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
            headers={['Track', 'Share Link', 'User Agent', 'When']}
            rows={downloads.map(d => [
              (d.track as any)?.title || 'Unknown',
              getShareLabel(d),
              truncateUA(d.user_agent),
              formatDate(d.created_at),
            ])}
          />
        )
      )}
    </div>
  )
}

function truncateUA(ua: string | null) {
  if (!ua) return '—'
  if (ua.length <= 60) return ua
  return ua.slice(0, 60) + '...'
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
