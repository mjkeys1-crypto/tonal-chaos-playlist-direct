import { useEffect, useState } from 'react'
import { Plus, ListMusic, Loader2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { listPlaylists, createPlaylist } from '../lib/api/playlists'
import { useAuth } from '../context/AuthContext'
import type { Playlist } from '../lib/types'

export default function PlaylistsPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [title, setTitle] = useState('')
  const [clientName, setClientName] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    listPlaylists().then(setPlaylists).finally(() => setLoading(false))
  }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !title.trim()) return
    setCreating(true)
    try {
      const pl = await createPlaylist(title.trim(), clientName.trim() || null, null, user.id)
      navigate(`/playlists/${pl.id}`)
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Playlists</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Plus size={16} />
          New Playlist
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-zinc-500" size={24} />
        </div>
      ) : playlists.length === 0 ? (
        <div className="text-center py-20">
          <ListMusic className="mx-auto mb-3 text-zinc-600" size={48} />
          <p className="text-zinc-400">No playlists yet. Create one to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {playlists.map(pl => (
            <button
              key={pl.id}
              onClick={() => navigate(`/playlists/${pl.id}`)}
              className="text-left bg-zinc-900 border border-zinc-800 rounded-lg p-5 hover:border-zinc-600 transition-colors"
            >
              <h3 className="font-semibold truncate">{pl.title}</h3>
              {pl.client_name && <p className="text-sm text-zinc-400 mt-1">For {pl.client_name}</p>}
              <p className="text-xs text-zinc-500 mt-2">
                {new Date(pl.created_at).toLocaleDateString()}
              </p>
            </button>
          ))}
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-sm p-6">
            <h2 className="text-lg font-semibold mb-4">New Playlist</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm text-zinc-300 mb-1">Title</label>
                <input
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  required
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="e.g. Marvel Studios Pitch"
                />
              </div>
              <div>
                <label className="block text-sm text-zinc-300 mb-1">Client Name (optional)</label>
                <input
                  value={clientName}
                  onChange={e => setClientName(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="e.g. Marvel Studios"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white py-2 rounded-lg text-sm transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  {creating ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
