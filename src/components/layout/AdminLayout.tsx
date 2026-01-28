import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { PlayerProvider } from '../../context/PlayerContext'
import PlayerBar from '../player/PlayerBar'
import { LayoutDashboard, Music, ListMusic, BarChart3, LogOut } from 'lucide-react'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/tracks', icon: Music, label: 'Tracks' },
  { to: '/playlists', icon: ListMusic, label: 'Playlists' },
  { to: '/analytics', icon: BarChart3, label: 'Analytics' },
]

export default function AdminLayout() {
  const { signOut } = useAuth()

  return (
    <PlayerProvider>
      <div className="min-h-screen bg-zinc-950 text-white flex">
        {/* Sidebar */}
        <aside className="w-56 border-r border-zinc-800 flex flex-col shrink-0">
          <div className="p-5 border-b border-zinc-800">
            <h1 className="text-lg font-bold tracking-tight">Tonal Chaos</h1>
          </div>
          <nav className="flex-1 p-3 space-y-1">
            {navItems.map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                    isActive
                      ? 'bg-zinc-800 text-white'
                      : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
                  }`
                }
              >
                <Icon size={18} />
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="p-3 border-t border-zinc-800">
            <button
              onClick={signOut}
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-zinc-400 hover:text-white hover:bg-zinc-800/50 w-full transition-colors"
            >
              <LogOut size={18} />
              Sign Out
            </button>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-auto pb-20">
          <Outlet />
        </main>

        <PlayerBar />
      </div>
    </PlayerProvider>
  )
}
