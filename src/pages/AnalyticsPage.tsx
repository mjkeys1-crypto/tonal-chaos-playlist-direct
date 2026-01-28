import { useEffect, useState } from 'react'
import { BarChart3, Loader2 } from 'lucide-react'
import { getPlaysByTrack, getRecentPlays } from '../lib/api/analytics'

export default function AnalyticsPage() {
  const [trackPlays, setTrackPlays] = useState<{ id: string; title: string; count: number }[]>([])
  const [recentPlays, setRecentPlays] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([getPlaysByTrack(), getRecentPlays(20)])
      .then(([tp, rp]) => { setTrackPlays(tp); setRecentPlays(rp) })
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-zinc-500" size={24} />
      </div>
    )
  }

  const maxCount = Math.max(...trackPlays.map(t => t.count), 1)

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">Analytics</h1>

      {trackPlays.length === 0 && recentPlays.length === 0 ? (
        <div className="text-center py-20">
          <BarChart3 className="mx-auto mb-3 text-zinc-600" size={48} />
          <p className="text-zinc-400">No play data yet. Share some playlists to see analytics.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Plays by track */}
          <div>
            <h2 className="text-lg font-semibold mb-4">Plays by Track</h2>
            <div className="space-y-3">
              {trackPlays.map(t => (
                <div key={t.id}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="truncate mr-4">{t.title}</span>
                    <span className="text-zinc-400 tabular-nums">{t.count}</span>
                  </div>
                  <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-500 rounded-full"
                      style={{ width: `${(t.count / maxCount) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent plays */}
          <div>
            <h2 className="text-lg font-semibold mb-4">Recent Plays</h2>
            <div className="border border-zinc-800 rounded-lg overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="text-xs text-zinc-500 uppercase border-b border-zinc-800">
                    <th className="px-4 py-3 text-left">Track</th>
                    <th className="px-4 py-3 text-left">When</th>
                  </tr>
                </thead>
                <tbody>
                  {recentPlays.map(p => (
                    <tr key={p.id} className="border-b border-zinc-800/50">
                      <td className="px-4 py-2.5 text-sm truncate max-w-xs">{(p.track as any)?.title || 'Unknown'}</td>
                      <td className="px-4 py-2.5 text-xs text-zinc-500">
                        {new Date(p.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
