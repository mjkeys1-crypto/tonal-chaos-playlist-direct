import { createBrowserRouter, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import AdminLayout from './components/layout/AdminLayout'
import Login from './pages/Login'
import TracksPage from './pages/TracksPage'
import PlaylistsPage from './pages/PlaylistsPage'
import PlaylistDetail from './pages/PlaylistDetail'
import AnalyticsPage from './pages/AnalyticsPage'
import ShareAnalytics from './pages/ShareAnalytics'
import SharedPlaylist from './pages/SharedPlaylist'
import type { ReactNode } from 'react'

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="min-h-screen bg-zinc-950" />
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

function PublicOnly({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="min-h-screen bg-zinc-950" />
  if (user) return <Navigate to="/" replace />
  return <>{children}</>
}

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <PublicOnly><Login /></PublicOnly>,
  },
  {
    path: '/s/:token',
    element: <SharedPlaylist />,
  },
  {
    element: <ProtectedRoute><AdminLayout /></ProtectedRoute>,
    children: [
      { index: true, element: <TracksPage /> },
      { path: 'playlists', element: <PlaylistsPage /> },
      { path: 'playlists/:id', element: <PlaylistDetail /> },
      { path: 'analytics', element: <AnalyticsPage /> },
      { path: 'analytics/:shareId', element: <ShareAnalytics /> },
    ],
  },
])
