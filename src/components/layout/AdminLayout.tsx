import { useState, useEffect, useRef } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { PlayerProvider } from '../../context/PlayerContext'
import PlayerBar from '../player/PlayerBar'
import { Music, ListMusic, BarChart3, LogOut, Menu, X, Bell, HelpCircle, Eye, Play, Download } from 'lucide-react'
import { getRecentActivity, type ActivityNotification } from '../../lib/api/analytics'

const navItems = [
  { to: '/', icon: Music, label: 'Tracks' },
  { to: '/playlists', icon: ListMusic, label: 'Playlists' },
  { to: '/analytics', icon: BarChart3, label: 'Analytics' },
]

export default function AdminLayout() {
  const { signOut } = useAuth()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [notifications, setNotifications] = useState<ActivityNotification[]>([])
  const [showNotifications, setShowNotifications] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [lastSeenTime, setLastSeenTime] = useState<string | null>(null)
  const notificationRef = useRef<HTMLDivElement>(null)

  // Load last seen time from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('lastSeenNotificationTime')
    setLastSeenTime(saved)
  }, [])

  // Fetch notifications periodically
  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const data = await getRecentActivity(20)
        setNotifications(data)
      } catch (e) {
        console.error('Failed to fetch notifications:', e)
      }
    }
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 30000) // Refresh every 30 seconds
    return () => clearInterval(interval)
  }, [])

  // Close notification dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(e.target as Node)) {
        setShowNotifications(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Count unread notifications
  const unreadCount = lastSeenTime
    ? notifications.filter(n => new Date(n.timestamp) > new Date(lastSeenTime)).length
    : notifications.length

  const markAllRead = () => {
    const now = new Date().toISOString()
    localStorage.setItem('lastSeenNotificationTime', now)
    setLastSeenTime(now)
  }

  const handleBellClick = () => {
    if (!showNotifications) {
      markAllRead()
    }
    setShowNotifications(!showNotifications)
  }

  // Close mobile menu on navigation
  const handleNavClick = () => setMobileMenuOpen(false)

  const formatTimeAgo = (timestamp: string) => {
    const seconds = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000)
    if (seconds < 60) return 'just now'
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    return `${days}d ago`
  }

  const getActivityIcon = (type: ActivityNotification['type']) => {
    switch (type) {
      case 'view': return <Eye size={14} className="text-blue-400" />
      case 'play': return <Play size={14} className="text-green-400" />
      case 'download': return <Download size={14} className="text-purple-400" />
    }
  }

  const getActivityText = (n: ActivityNotification) => {
    const who = n.email || 'Unknown visitor'
    switch (n.type) {
      case 'view':
        return <><span className="font-medium text-white">{who}</span> viewed <span className="text-zinc-300">{n.shareLabel}</span></>
      case 'play':
        return <><span className="font-medium text-white">{who}</span> played <span className="text-zinc-300">{n.trackTitle || 'a track'}</span></>
      case 'download':
        return <><span className="font-medium text-white">{who}</span> downloaded <span className="text-zinc-300">{n.trackTitle || 'a track'}</span></>
    }
  }

  return (
    <PlayerProvider>
      <div className="min-h-screen bg-zinc-950 text-white flex flex-col md:flex-row">
        {/* Mobile header */}
        <div className="md:hidden flex items-center justify-between p-4 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Tonal Chaos Select" className="w-7 h-7 object-contain" />
            <h1 className="text-sm font-bold tracking-wide uppercase whitespace-nowrap" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
              <span className="bg-gradient-to-r from-zinc-200 via-blue-300 to-indigo-400 bg-clip-text text-transparent">Tonal Chaos</span>
              <span className="ml-1 text-white">Select</span>
            </h1>
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
                <img src="/logo.png" alt="Tonal Chaos Select" className="w-8 h-8 object-contain" />
                <h1 className="text-sm font-bold tracking-wide uppercase whitespace-nowrap" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
                  <span className="bg-gradient-to-r from-zinc-200 via-blue-300 to-indigo-400 bg-clip-text text-transparent">Tonal Chaos</span>
                  <span className="ml-1 text-white">Select</span>
                </h1>
              </div>
              <div className="flex items-center gap-2">
                {/* Close button for mobile */}
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="md:hidden p-1 text-zinc-400 hover:text-white transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
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
        <main className="flex-1 overflow-auto pb-20 flex flex-col">
          {/* Top bar with notifications and help */}
          <div className="flex items-center justify-end gap-2 p-4 border-b border-zinc-800/50">
            {/* Notification bell */}
            <div ref={notificationRef} className="relative">
              <button
                onClick={handleBellClick}
                className={`relative p-2 rounded-lg transition-colors ${
                  showNotifications ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
                }`}
              >
                <Bell size={20} />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 rounded-full text-[10px] font-bold flex items-center justify-center text-white animate-pulse">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {/* Notification dropdown */}
              {showNotifications && (
                <div className="absolute right-0 top-full mt-2 w-80 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl z-50 overflow-hidden">
                  <div className="p-3 border-b border-zinc-800 flex items-center justify-between">
                    <h3 className="font-semibold text-sm">Activity</h3>
                    {notifications.length > 0 && (
                      <button
                        onClick={markAllRead}
                        className="text-xs text-indigo-400 hover:text-indigo-300"
                      >
                        Mark all read
                      </button>
                    )}
                  </div>
                  <div className="max-h-80 overflow-auto">
                    {notifications.length === 0 ? (
                      <div className="p-6 text-center text-zinc-500 text-sm">
                        No activity yet
                      </div>
                    ) : (
                      notifications.map(n => (
                        <div
                          key={n.id}
                          className={`px-3 py-2.5 border-b border-zinc-800/50 hover:bg-zinc-800/30 ${
                            lastSeenTime && new Date(n.timestamp) > new Date(lastSeenTime)
                              ? 'bg-indigo-900/10'
                              : ''
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            <div className="mt-0.5">{getActivityIcon(n.type)}</div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-zinc-400 leading-snug">
                                {getActivityText(n)}
                              </p>
                              <p className="text-xs text-zinc-600 mt-0.5">{formatTimeAgo(n.timestamp)}</p>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Help button */}
            <button
              onClick={() => setShowHelp(true)}
              className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800/50 transition-colors"
            >
              <HelpCircle size={20} />
            </button>
          </div>

          <div className="flex-1 overflow-auto">
            <Outlet />
          </div>
        </main>

        {/* Help Modal */}
        {showHelp && (
          <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setShowHelp(false)}>
            <div
              className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-3xl max-h-[85vh] flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-4 border-b border-zinc-800">
                <h2 className="font-semibold text-lg">How to Use Tonal Chaos Select</h2>
                <button onClick={() => setShowHelp(false)} className="text-zinc-400 hover:text-white">
                  <X size={20} />
                </button>
              </div>
              <div className="flex-1 overflow-auto p-6 space-y-6 text-sm text-zinc-300">
                <section>
                  <h3 className="text-base font-semibold text-white mb-2 flex items-center gap-2">
                    <Music size={18} className="text-indigo-400" /> Tracks Library
                  </h3>
                  <ul className="list-disc list-inside space-y-1.5 text-zinc-400">
                    <li><span className="text-white">Upload tracks</span> by clicking "Upload Tracks" or dragging audio files directly onto the page</li>
                    <li>Supported formats: MP3, AIFF, WAV, FLAC, M4A (MP3 & AIFF preferred for smaller file sizes)</li>
                    <li><span className="text-white">Edit metadata</span> by clicking on any track row - change title, artist, description, BPM, duration, and tags</li>
                    <li><span className="text-white">Play previews</span> using the play button on each track</li>
                    <li><span className="text-white">Delete tracks</span> by selecting them with checkboxes and clicking "Delete Selected"</li>
                    <li><span className="text-white">Download originals</span> using the download button on each track</li>
                  </ul>
                </section>

                <section>
                  <h3 className="text-base font-semibold text-white mb-2 flex items-center gap-2">
                    <ListMusic size={18} className="text-indigo-400" /> Playlists
                  </h3>
                  <ul className="list-disc list-inside space-y-1.5 text-zinc-400">
                    <li><span className="text-white">Create playlists</span> for clients or projects with custom titles and descriptions</li>
                    <li><span className="text-white">Add tracks</span> by dragging from the Library column on the left to a playlist section on the right</li>
                    <li><span className="text-white">Organize with sections</span> - create named sections (e.g., "Main Cues", "Alternates") to group tracks</li>
                    <li><span className="text-white">Reorder sections</span> using the up/down arrows or by dragging the handle</li>
                    <li><span className="text-white">Reorder tracks</span> within sections by dragging them</li>
                    <li><span className="text-white">Remove tracks</span> from playlists by clicking the X button (original track stays in Library)</li>
                    <li><span className="text-white">Add artwork</span> by clicking the image area and uploading a cover image</li>
                    <li><span className="text-white">Duplicate playlists</span> to use as a starting point for similar projects</li>
                  </ul>
                </section>

                <section>
                  <h3 className="text-base font-semibold text-white mb-2 flex items-center gap-2">
                    <Bell size={18} className="text-indigo-400" /> Sharing & Share Links
                  </h3>
                  <ul className="list-disc list-inside space-y-1.5 text-zinc-400">
                    <li><span className="text-white">Create share links</span> for each playlist by clicking the share button</li>
                    <li>Each link gets a unique URL you can send to clients</li>
                    <li><span className="text-white">Name your links</span> (e.g., "Netflix - Round 1", "John Smith") for easy tracking</li>
                    <li><span className="text-white">Options per link:</span></li>
                    <li className="ml-4">• <span className="text-white">Recipient Email</span> - pre-associate a link with a specific email for automatic tracking</li>
                    <li className="ml-4">• <span className="text-white">Allow Downloads</span> - let recipients download original audio files</li>
                    <li className="ml-4">• <span className="text-white">Require Email</span> - visitors must enter their email before viewing</li>
                    <li className="ml-4">• <span className="text-white">Password Protection</span> - add a password for extra security</li>
                    <li className="ml-4">• <span className="text-white">Expiration</span> - auto-expire links after a set number of days</li>
                    <li><span className="text-white">Toggle links on/off</span> to temporarily disable access without deleting</li>
                  </ul>
                </section>

                <section>
                  <h3 className="text-base font-semibold text-white mb-2 flex items-center gap-2">
                    <BarChart3 size={18} className="text-indigo-400" /> Analytics
                  </h3>
                  <ul className="list-disc list-inside space-y-1.5 text-zinc-400">
                    <li><span className="text-white">Track engagement</span> across all your shared playlists</li>
                    <li><span className="text-white">Views</span> - see who visited your playlists and when</li>
                    <li><span className="text-white">Plays</span> - track which tracks were played and by whom</li>
                    <li><span className="text-white">Downloads</span> - monitor who downloaded tracks (when enabled)</li>
                    <li><span className="text-white">Hover over checkmarks</span> in the Views tab to see exactly which tracks were played/downloaded</li>
                    <li>Use <span className="text-white">"Require Email"</span> on share links to capture visitor identity</li>
                  </ul>
                </section>

                <section>
                  <h3 className="text-base font-semibold text-white mb-2 flex items-center gap-2">
                    <Bell size={18} className="text-indigo-400" /> Notifications
                  </h3>
                  <ul className="list-disc list-inside space-y-1.5 text-zinc-400">
                    <li>The <span className="text-white">bell icon</span> shows real-time activity on your shared playlists</li>
                    <li>A <span className="text-red-400">red badge</span> indicates new activity since you last checked</li>
                    <li>Click the bell to see who viewed, played, or downloaded tracks</li>
                    <li>Activity updates automatically every 30 seconds</li>
                  </ul>
                </section>

                <section className="pb-2">
                  <h3 className="text-base font-semibold text-white mb-2">Tips</h3>
                  <ul className="list-disc list-inside space-y-1.5 text-zinc-400">
                    <li>Use <span className="text-white">descriptive share link names</span> to track which clients are engaging</li>
                    <li>Create <span className="text-white">separate links for each recipient</span> for detailed individual tracking</li>
                    <li><span className="text-white">Duplicate playlists</span> to quickly create variations for different pitches</li>
                    <li>Use <span className="text-white">sections</span> to organize long playlists logically</li>
                  </ul>
                </section>
              </div>
            </div>
          </div>
        )}

        <PlayerBar />
      </div>
    </PlayerProvider>
  )
}
