import { useState, useEffect } from 'react'
import { X, Copy, Check, Link, Trash2, ToggleLeft, ToggleRight } from 'lucide-react'
import { listSharesForPlaylist, createShare, deleteShare, toggleShareActive } from '../../lib/api/shares'
import type { Share } from '../../lib/types'

interface Props {
  playlistId: string
  onClose: () => void
}

export default function ShareDialog({ playlistId, onClose }: Props) {
  const [shares, setShares] = useState<Share[]>([])
  const [, setLoading] = useState(true)
  const [label, setLabel] = useState('')
  const [recipientEmail, setRecipientEmail] = useState('')
  const [allowDownload, setAllowDownload] = useState(false)
  const [requireEmail, setRequireEmail] = useState(false)
  const [password, setPassword] = useState('')
  const [expiryDays, setExpiryDays] = useState('')
  const [creating, setCreating] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)

  const loadShares = async () => {
    const data = await listSharesForPlaylist(playlistId)
    setShares(data)
    setLoading(false)
  }

  useEffect(() => { loadShares() }, [playlistId])

  const handleCreate = async () => {
    setCreating(true)
    try {
      const expiresAt = expiryDays
        ? new Date(Date.now() + parseInt(expiryDays) * 86400000).toISOString()
        : null
      await createShare(playlistId, {
        label: label.trim(),
        allowDownload,
        requireEmail: requireEmail && !recipientEmail.trim(), // Don't require email if pre-associated
        recipientEmail: recipientEmail.trim() || null,
        passwordHash: password || null,
        expiresAt,
      })
      setLabel('')
      setRecipientEmail('')
      setPassword('')
      setExpiryDays('')
      setAllowDownload(false)
      setRequireEmail(false)
      loadShares()
    } finally {
      setCreating(false)
    }
  }

  const copyLink = (slug: string) => {
    const url = `${window.location.origin}/s/${slug}`
    navigator.clipboard.writeText(url)
    setCopied(slug)
    setTimeout(() => setCopied(null), 2000)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this share link?')) return
    await deleteShare(id)
    loadShares()
  }

  const handleToggle = async (share: Share) => {
    await toggleShareActive(share.id, !share.is_active)
    loadShares()
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-lg max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-zinc-800">
          <h2 className="font-semibold text-lg">Share Links</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-white"><X size={20} /></button>
        </div>

        <div className="flex-1 overflow-auto p-4 space-y-4">
          {/* Create new */}
          <div className="border border-zinc-700 rounded-lg p-4 space-y-3">
            <h3 className="text-sm font-medium text-zinc-300">Create New Link</h3>
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">Recipient / Label *</label>
              <input
                type="text"
                value={label}
                onChange={e => setLabel(e.target.value)}
                placeholder="e.g. Netflix, John Smith"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">Recipient Email (optional)</label>
              <input
                type="email"
                value={recipientEmail}
                onChange={e => setRecipientEmail(e.target.value)}
                placeholder="client@company.com"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <p className="text-xs text-zinc-600 mt-1">Pre-associate this link with an email for automatic tracking</p>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-zinc-400">Allow downloads</span>
              <button onClick={() => setAllowDownload(!allowDownload)}>
                {allowDownload
                  ? <ToggleRight size={24} className="text-indigo-400" />
                  : <ToggleLeft size={24} className="text-zinc-600" />
                }
              </button>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm text-zinc-400">Require email to view</span>
                <p className="text-xs text-zinc-600">Visitor must enter email before accessing playlist</p>
              </div>
              <button onClick={() => setRequireEmail(!requireEmail)}>
                {requireEmail
                  ? <ToggleRight size={24} className="text-indigo-400" />
                  : <ToggleLeft size={24} className="text-zinc-600" />
                }
              </button>
            </div>
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">Password (optional)</label>
              <input
                type="text"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Leave empty for no password"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">Expires after (days, optional)</label>
              <input
                type="number"
                value={expiryDays}
                onChange={e => setExpiryDays(e.target.value)}
                placeholder="e.g. 30"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <button
              onClick={handleCreate}
              disabled={creating || !label.trim()}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium py-2 rounded-lg transition-colors"
            >
              {creating ? 'Creating...' : 'Create Share Link'}
            </button>
          </div>

          {/* Existing shares */}
          {shares.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-zinc-300">Existing Links</h3>
              {shares.map(share => (
                <div key={share.id} className="flex items-center gap-3 bg-zinc-800 rounded-lg px-3 py-2.5">
                  <Link size={14} className={share.is_active ? 'text-green-400' : 'text-zinc-600'} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{share.label || share.slug}</p>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-zinc-500 mt-0.5">
                      <span className="font-mono">/s/{share.slug}</span>
                      {share.recipient_email && <span className="text-green-400">{share.recipient_email}</span>}
                      {share.password_hash && <span>Password</span>}
                      {share.allow_download && <span>Downloads</span>}
                      {share.require_email && <span className="text-indigo-400">Email Gate</span>}
                      {share.expires_at && (
                        <span>Exp: {new Date(share.expires_at).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>
                  <button onClick={() => copyLink(share.slug)} className="text-zinc-400 hover:text-white">
                    {copied === share.slug ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                  </button>
                  <button onClick={() => handleToggle(share)} className="text-zinc-400 hover:text-white">
                    {share.is_active
                      ? <ToggleRight size={18} className="text-green-400" />
                      : <ToggleLeft size={18} className="text-zinc-600" />
                    }
                  </button>
                  <button onClick={() => handleDelete(share.id)} className="text-zinc-500 hover:text-red-400">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
