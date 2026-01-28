import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { PlayerProvider } from '../../context/PlayerContext'
import PlayerBar from '../player/PlayerBar'
import { Music, ListMusic, BarChart3, LogOut, Menu, X } from 'lucide-react'

const navItems = [
  { to: '/', icon: Music, label: 'Tracks' },
  { to: '/playlists', icon: ListMusic, label: 'Playlists' },
  { to: '/analytics', icon: BarChart3, label: 'Analytics' },
]

export default function AdminLayout() {
  const { signOut } = useAuth()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Close mobile menu on navigation
  const handleNavClick = () => setMobileMenuOpen(false)

  return (
    <PlayerProvider>
      <div className="min-h-screen bg-zinc-950 text-white flex flex-col md:flex-row">
        {/* Mobile header */}
        <div className="md:hidden flex items-center justify-between p-4 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Tonal Chaos" className="w-7 h-7 object-contain" />
            <h1 className="text-base font-bold tracking-wide uppercase bg-gradient-to-r from-zinc-200 via-blue-300 to-indigo-400 bg-clip-text text-transparent" style={{ fontFamily: 'Rajdhani, sans-serif' }}>Tonal Chaos</h1>
          </div>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 text-zinc-400 hover:text-white transition-colors"
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile menu overlay */}
        {mobileMenuOpen && (
          <div className="md:hidden fixed inset-0 z-50 bg-black/60" onClick={() => setMobileMenuOpen(false)} />
        )}

        {/* Sidebar - hidden on mobile unless menu is open */}
        <aside className={`${
          mobileMenuOpen
            ? 'fixed inset-y-0 left-0 z-50 w-64'
            : 'hidden'
        } md:relative md:flex md:w-56 border-r border-zinc-800 flex-col shrink-0 relative overflow-hidden bg-zinc-950`}>
          {/* Animated orbs */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute -top-10 -left-10 w-40 h-40 bg-blue-600/15 rounded-full blur-[80px] animate-[pulse_8s_ease-in-out_infinite]" />
            <div className="absolute top-1/3 -right-10 w-32 h-32 bg-purple-600/15 rounded-full blur-[70px] animate-[pulse_6s_ease-in-out_infinite_1s]" />
            <div className="absolute bottom-20 -left-5 w-28 h-28 bg-indigo-500/10 rounded-full blur-[60px] animate-[pulse_10s_ease-in-out_infinite_2s]" />
          </div>

          <div className="relative z-10 p-5 border-b border-zinc-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img src="/logo.png" alt="Tonal Chaos" className="w-8 h-8 object-contain" />
                <h1 className="text-lg font-bold tracking-wide uppercase bg-gradient-to-r from-zinc-200 via-blue-300 to-indigo-400 bg-clip-text text-transparent" style={{ fontFamily: 'Rajdhani, sans-serif' }}>Tonal Chaos</h1>
              </div>
              {/* Close button for mobile */}
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="md:hidden p-1 text-zinc-400 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>
          </div>
          <nav className="relative z-10 flex-1 p-3 space-y-1">
            {navItems.map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                onClick={handleNavClick}
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
          <div className="relative z-10 p-3 border-t border-zinc-800">
            <button
              onClick={() => { handleNavClick(); signOut() }}
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
