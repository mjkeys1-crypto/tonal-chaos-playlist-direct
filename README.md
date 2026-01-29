# Tonal Chaos - Music Playlist Sharing Platform

A professional music licensing and playlist sharing application for Tonal Chaos. Allows music supervisors, composers, and clients to share curated playlists with secure, trackable share links.

## Tech Stack

### Frontend
- **React 19** - UI framework
- **TypeScript** - Type safety
- **Vite 7** - Build tool and dev server
- **Tailwind CSS 4** - Styling
- **React Router 7** - Client-side routing
- **Lucide React** - Icons
- **dnd-kit** - Drag and drop functionality
- **Recharts** - Analytics charts
- **WaveSurfer.js** - Audio waveform visualization
- **music-metadata-browser** - Audio file metadata extraction
- **JSZip** - Bulk download functionality

### Backend / Database
- **Supabase** - Backend-as-a-Service
  - PostgreSQL database
  - Authentication (email/password)
  - Storage (audio files, artwork)
  - Row Level Security (RLS) policies

### Hosting
- **Cloudflare Pages** - Frontend hosting and CDN
- **Supabase** - Database and file storage

---

## Supabase Configuration

### Project Details
- **Project URL:** `https://qqhvolzqccyyhetmrfnx.supabase.co`
- **Storage Bucket:** `tracks` (stores audio files and playlist artwork)
- **Auth:** Email/password authentication

### Database Tables

#### `profiles`
User profiles linked to Supabase Auth.
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key (matches auth.users.id) |
| email | text | User email |
| full_name | text | Display name |
| avatar_url | text | Profile image URL |
| created_at | timestamp | Creation date |

#### `tracks`
Audio files uploaded to the library.
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| title | text | Track title |
| artist | text | Artist name |
| album | text | Album name |
| year | integer | Release year |
| genre | text | Genre |
| composer | text | Composer name |
| publisher | text | Publisher |
| bpm | integer | Beats per minute |
| key | text | Musical key |
| isrc | text | ISRC code |
| copyright | text | Copyright info |
| comment | text | Description/notes |
| duration | numeric | Length in seconds |
| format | text | File format (mp3, wav, etc.) |
| file_size | bigint | File size in bytes |
| storage_path | text | Path in Supabase storage |
| artwork_path | text | Cover art path |
| waveform_data | jsonb | Pre-computed waveform |
| owner_id | uuid | Foreign key to profiles |
| created_at | timestamp | Upload date |

#### `playlists`
Collections of tracks for sharing.
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| title | text | Playlist name |
| description | text | Description |
| client_name | text | Client/project name |
| artwork_path | text | Cover image path |
| owner_id | uuid | Foreign key to profiles |
| created_at | timestamp | Creation date |
| updated_at | timestamp | Last modified |

#### `sections`
Organizational sections within playlists.
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| playlist_id | uuid | Foreign key to playlists |
| title | text | Section name |
| emoji | text | Optional emoji icon |
| position | integer | Sort order |
| is_expanded | boolean | UI state |
| created_at | timestamp | Creation date |

#### `playlist_tracks`
Junction table linking tracks to playlists.
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| playlist_id | uuid | Foreign key to playlists |
| section_id | uuid | Foreign key to sections (nullable) |
| track_id | uuid | Foreign key to tracks |
| position | integer | Sort order within section |
| created_at | timestamp | Added date |

#### `share_links`
Shareable URLs for playlists.
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| playlist_id | uuid | Foreign key to playlists |
| slug | text | URL identifier (12 chars) |
| label | text | Recipient name/identifier |
| access_mode | text | 'link' or 'email_verified' |
| password_hash | text | Optional password protection |
| allow_download | boolean | Enable track downloads |
| require_email | boolean | Require email to view |
| recipient_email | text | Pre-associated email |
| expires_at | timestamp | Expiration date |
| is_active | boolean | Enable/disable link |
| created_at | timestamp | Creation date |

#### `analytics_events`
Page view tracking.
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| share_link_id | uuid | Foreign key to share_links |
| event_type | text | Event type (e.g., 'page_view') |
| metadata | jsonb | Additional data |
| created_at | timestamp | Event time |

#### `play_events`
Track play tracking.
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| track_id | uuid | Foreign key to tracks |
| share_id | uuid | Foreign key to share_links |
| listener_email | text | Viewer's email |
| listener_ip | text | IP address |
| duration_listened | numeric | Seconds played |
| completed | boolean | Played to completion |
| user_agent | text | Browser info |
| country | text | Geo location |
| city | text | Geo location |
| device_type | text | Desktop/mobile |
| created_at | timestamp | Play time |

#### `download_events`
Track download tracking.
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| track_id | uuid | Foreign key to tracks |
| share_id | uuid | Foreign key to share_links |
| listener_email | text | Downloader's email |
| listener_ip | text | IP address |
| user_agent | text | Browser info |
| country | text | Geo location |
| city | text | Geo location |
| device_type | text | Desktop/mobile |
| created_at | timestamp | Download time |

---

## Project Structure

```
tonal-chaos-playlist-direct/
├── public/
│   └── logo.png                 # App logo/favicon
├── src/
│   ├── components/
│   │   ├── layout/
│   │   │   └── AdminLayout.tsx  # Main admin layout with sidebar
│   │   ├── player/
│   │   │   └── PlayerBar.tsx    # Audio player with waveform
│   │   ├── shares/
│   │   │   └── ShareDialog.tsx  # Share link management modal
│   │   └── tracks/
│   │       ├── TrackRow.tsx     # Track list item
│   │       └── TrackUploader.tsx # File upload component
│   ├── context/
│   │   ├── AuthContext.tsx      # Authentication state
│   │   └── PlayerContext.tsx    # Global audio player state
│   ├── lib/
│   │   ├── api/
│   │   │   ├── analytics.ts     # Analytics API functions
│   │   │   ├── playlists.ts     # Playlist CRUD operations
│   │   │   ├── shares.ts        # Share link operations
│   │   │   └── tracks.ts        # Track CRUD operations
│   │   ├── supabase.ts          # Supabase client config
│   │   └── types.ts             # TypeScript interfaces
│   ├── pages/
│   │   ├── AnalyticsPage.tsx    # Analytics dashboard
│   │   ├── Login.tsx            # Authentication page
│   │   ├── PlaylistDetail.tsx   # Single playlist editor
│   │   ├── PlaylistsPage.tsx    # Playlist builder (3-column)
│   │   ├── SharedPlaylist.tsx   # Public playlist view
│   │   └── TracksPage.tsx       # Track library manager
│   ├── App.tsx                  # Root component
│   ├── main.tsx                 # Entry point
│   ├── router.tsx               # Route definitions
│   └── index.css                # Global styles
├── .claude/
│   └── CLAUDE.md                # AI assistant instructions
├── index.html                   # HTML template
├── package.json                 # Dependencies
├── tailwind.config.js           # Tailwind configuration
├── tsconfig.json                # TypeScript configuration
└── vite.config.ts               # Vite configuration
```

---

## Features

### Track Library
- Upload audio files (MP3, AIFF, WAV, FLAC, M4A)
- Automatic metadata extraction (title, artist, BPM, duration)
- Waveform visualization
- Edit track metadata inline
- Bulk delete with selection
- Drag-and-drop upload

### Playlists
- Create playlists for clients/projects
- Organize tracks into sections
- Drag-and-drop reordering
- Custom playlist artwork
- Duplicate playlists as templates

### Share Links
- Generate unique shareable URLs (/s/[slug])
- Per-link settings:
  - Label (recipient name)
  - Pre-associated email
  - Allow/disallow downloads
  - Require email to view
  - Password protection
  - Expiration date
- Enable/disable links without deleting

### Analytics
- Track page views
- Track plays with listener identification
- Track downloads
- View activity by share link
- Real-time notification bell
- Tooltips showing which tracks were played/downloaded

### Client View (Public)
- Clean, branded playlist presentation
- Audio streaming with waveform
- Optional download buttons
- Email gate for access
- Mobile responsive

---

## Development Setup

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/mjkeys1-crypto/tonal-chaos-playlist-direct.git
cd tonal-chaos-playlist-direct

# Install dependencies
npm install

# Start development server
npm run dev
```

The app will be available at `http://localhost:5173`

### Environment Variables

The Supabase credentials are currently hardcoded in `src/lib/supabase.ts`. For production, these should be moved to environment variables:

```env
VITE_SUPABASE_URL=https://qqhvolzqccyyhetmrfnx.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

---

## Deployment

### Cloudflare Pages

The app is deployed to Cloudflare Pages:
- **Production URL:** https://tonal-chaos-playlist-direct.pages.dev
- **GitHub Repo:** mjkeys1-crypto/tonal-chaos-playlist-direct
- **Branch:** main

### Deploy Commands

```bash
# Build for production
npm run build

# Deploy to Cloudflare Pages (via Wrangler)
npx wrangler pages deploy dist
```

### Build Configuration
- **Build command:** `npm run build`
- **Output directory:** `dist`
- **Node version:** 18+

---

## Authentication

Currently uses Supabase Auth with email/password.

Admin access requires a Supabase Auth account. Create users in the Supabase dashboard under Authentication > Users.

---

## API Routes (Frontend)

All API calls go through the Supabase client. Key endpoints:

| Function | File | Description |
|----------|------|-------------|
| `listTracks()` | tracks.ts | Get all tracks |
| `uploadTrack()` | tracks.ts | Upload audio file |
| `updateTrack()` | tracks.ts | Edit track metadata |
| `deleteTrack()` | tracks.ts | Remove track |
| `listPlaylists()` | playlists.ts | Get all playlists |
| `createPlaylist()` | playlists.ts | Create new playlist |
| `listPlaylistTracks()` | playlists.ts | Get tracks in playlist |
| `addTrackToPlaylist()` | playlists.ts | Add track to playlist |
| `createShare()` | shares.ts | Generate share link |
| `getShareByToken()` | shares.ts | Get share by URL slug |
| `getRecentActivity()` | analytics.ts | Get notification feed |

---

## Storage

Audio files and images are stored in Supabase Storage:

- **Bucket:** `tracks`
- **Audio path:** `audio/{user_id}/{filename}`
- **Playlist artwork:** `playlist-artwork/{playlist_id}.{ext}`

Files are accessed via signed URLs generated on demand.

---

## Security

- **Row Level Security (RLS):** All tables have RLS policies
- **Owner-based access:** Users can only access their own data
- **Public share access:** Share links allow read-only access to specific playlists
- **Signed URLs:** Storage files accessed via time-limited signed URLs

---

## License

Private - Tonal Chaos

---

## Contact

For questions or support, contact marcus@tonalchaos.com
