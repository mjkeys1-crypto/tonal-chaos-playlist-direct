import { useEffect, useState } from 'react'
import { Music, ListMusic, Share2, Play, Download } from 'lucide-react'
import { getOverviewStats } from '../lib/api/analytics'

export default function Dashboard() {
  const [stats, setStats] = useState({
    tracks: 0, playlists: 0, activeShares: 0, totalPlays: 0, totalDownloads: 0,
  })

  useEffect(() => {
    getOverviewStats().then(setStats)
  }, [])

  const cards = [
    { label: 'Tracks', value: stats.tracks, icon: Music, color: 'text-blue-400' },
    { label: 'Playlists', value: stats.playlists, icon: ListMusic, color: 'text-purple-400' },
    { label: 'Active Shares', value: stats.activeShares, icon: Share2, color: 'text-green-400' },
    { label: 'Total Plays', value: stats.totalPlays, icon: Play, color: 'text-amber-400' },
    { label: 'Downloads', value: stats.totalDownloads, icon: Download, color: 'text-indigo-400' },
  ]

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {cards.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
            <Icon size={20} className={`${color} mb-3`} />
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-sm text-zinc-500 mt-1">{label}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
