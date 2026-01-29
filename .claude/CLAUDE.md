# Tonal Chaos Playlist Sharing App

A professional music licensing and playlist sharing platform for Tonal Chaos. Music supervisors, composers, and clients can share curated playlists with secure, trackable share links.

## Tech Stack
- **Frontend:** React 19 + TypeScript + Vite 7 + Tailwind CSS 4
- **Backend:** Supabase (PostgreSQL, Auth, Storage)
- **Hosting:** Cloudflare Pages
- **Key Libraries:**
  - React Router 7 (client-side routing)
  - dnd-kit (drag-and-drop)
  - WaveSurfer.js (audio waveform visualization)
  - Recharts (analytics charts)
  - Lucide React (icons)
  - music-metadata-browser (audio metadata extraction)
  - JSZip (bulk download)

## Supabase Project
- **URL:** https://qqhvolzqccyyhetmrfnx.supabase.co
- **Storage bucket:** `tracks` (audio files and playlist artwork)
- **Auth:** Email/password authentication

## Deployment
- **Production:** https://tonal-chaos-playlist-direct.pages.dev
- **GitHub:** mjkeys1-crypto/tonal-chaos-playlist-direct (branch: main)
- **Deploy command:** `npm run build && npx wrangler pages deploy dist --project-name=tonal-chaos-playlist-direct`

## Database Tables
| Table | Purpose |
|-------|---------|
| `profiles` | User profiles linked to Supabase Auth |
| `tracks` | Audio files with metadata (title, artist, BPM, duration, waveform_data) |
| `playlists` | Collections of tracks for sharing |
| `sections` | Organizational sections within playlists |
| `playlist_tracks` | Junction table linking tracks to playlists/sections |
| `share_links` | Shareable URLs with settings (password, expiration, download permissions) |
| `analytics_events` | Page view tracking |
| `play_events` | Track play tracking with listener info |
| `download_events` | Track download tracking |

## Key Features

### Track Library (`/tracks`)
- Upload audio files (MP3, AIFF, WAV, FLAC, M4A)
- Automatic metadata extraction from file tags
- Waveform visualization
- Inline metadata editing
- Bulk selection and delete
- Drag-and-drop upload

### Playlist Builder (`/playlists`)
- Three-column layout: playlist list | track library | playlist detail
- Create sections with emoji labels
- Drag tracks from library to playlist
- Reorder tracks and sections via drag-and-drop
- Custom playlist artwork
- Duplicate playlists

### Share Links
- Generate unique URLs (`/s/[slug]`)
- Per-link settings:
  - Label (recipient identifier)
  - Password protection
  - Expiration date
  - Allow/disallow downloads
  - Require email to view
- Enable/disable links without deleting

### Analytics (`/analytics`)
- Overview stats (tracks, playlists, plays, downloads)
- Recent plays and downloads with listener identification
- Plays by track chart
- Filter by share link

### Notification System
- Bell icon in admin header with unread count
- Real-time activity feed (views, plays, downloads)
- Shows listener email if available
- Auto-refreshes every 30 seconds

### Help Modal
- Accessible via `?` icon in admin header
- Comprehensive app documentation
- Covers all features and workflows

### Public Playlist View (`/s/[slug]`)
- Clean, branded presentation
- Audio streaming with waveform
- Optional download buttons
- Email gate (if required by share link)
- Mobile responsive

## Project Structure
```
src/
├── components/
│   ├── layout/AdminLayout.tsx    # Main admin layout with sidebar, notifications, help
│   ├── player/PlayerBar.tsx      # Global audio player with waveform
│   ├── shares/ShareDialog.tsx    # Share link management modal
│   └── tracks/
│       ├── TrackRow.tsx          # Track list item
│       └── TrackUploader.tsx     # File upload component
├── context/
│   ├── AuthContext.tsx           # Authentication state
│   └── PlayerContext.tsx         # Global audio player state
├── hooks/
│   └── usePlaylistTracks.ts      # Playlist tracks management hook
├── lib/
│   ├── api/
│   │   ├── analytics.ts          # Analytics queries
│   │   ├── playlists.ts          # Playlist CRUD
│   │   ├── shares.ts             # Share link operations
│   │   └── tracks.ts             # Track CRUD
│   ├── supabase.ts               # Supabase client config
│   └── types.ts                  # TypeScript interfaces
├── pages/
│   ├── AnalyticsPage.tsx         # Analytics dashboard
│   ├── Login.tsx                 # Authentication page
│   ├── PlaylistsPage.tsx         # Three-column playlist builder
│   ├── SharedPlaylist.tsx        # Public playlist view
│   └── TracksPage.tsx            # Track library manager
├── App.tsx                       # Root component
├── router.tsx                    # Route definitions
└── index.css                     # Global styles (Tailwind)
```

## Important Implementation Details

### Waveform Data
- Pre-computed on upload and stored in `tracks.waveform_data` as JSONB
- Displayed using WaveSurfer.js in player and track rows

### Analytics Deduplication
- Page views deduplicated by IP + share link (10-minute window)
- Play events deduplicated by IP + track + share (5-minute window)

### Section Management
- Sections have position for ordering
- Unsectioned tracks show at top in "Tracks" pseudo-section
- Can convert unsectioned tracks to a real section

### Storage Paths
- Audio: `audio/{user_id}/{filename}`
- Playlist artwork: `playlist-artwork/{playlist_id}.{ext}`

## TODO
- [ ] Create admin user for marcus@tonalchaos.com in Supabase Auth
- [ ] Bulk upload with drag-and-drop folder support
- [ ] Track search/filter in library
- [ ] Mobile responsive admin sidebar

## Completed Features
- [x] Email capture (require_email on share links)
- [x] Duplicate playlist functionality
- [x] Playlist artwork upload
- [x] Favicon (logo.png)
- [x] Notification bell with activity feed
- [x] Help modal with documentation
- [x] Analytics with listener identification
- [x] Section reordering via drag-and-drop
- [x] Waveform visualization in player and track rows
