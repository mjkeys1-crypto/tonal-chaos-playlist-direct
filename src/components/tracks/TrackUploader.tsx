import { useState, useCallback } from 'react'
import { Upload, X, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import { uploadTrack } from '../../lib/api/tracks'
import { useAuth } from '../../context/AuthContext'

interface UploadItem {
  file: File
  status: 'pending' | 'uploading' | 'done' | 'error'
  progress: number
  error?: string
}

interface Props {
  onComplete: () => void
  onClose: () => void
  initialFiles?: File[]
}

export default function TrackUploader({ onComplete, onClose, initialFiles }: Props) {
  const { user } = useAuth()
  const [items, setItems] = useState<UploadItem[]>(() => {
    if (initialFiles && initialFiles.length > 0) {
      return initialFiles.map(file => ({ file, status: 'pending' as const, progress: 0 }))
    }
    return []
  })
  const [dragging, setDragging] = useState(false)

  const addFiles = useCallback((files: FileList | File[]) => {
    const audioFiles = Array.from(files).filter(f =>
      f.type.startsWith('audio/') || /\.(wav|mp3|aiff|flac|m4a|ogg)$/i.test(f.name)
    )
    setItems(prev => [
      ...prev,
      ...audioFiles.map(file => ({ file, status: 'pending' as const, progress: 0 })),
    ])
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    addFiles(e.dataTransfer.files)
  }, [addFiles])

  const startUpload = async () => {
    if (!user) return
    for (let i = 0; i < items.length; i++) {
      if (items[i].status !== 'pending') continue
      setItems(prev => prev.map((item, idx) =>
        idx === i ? { ...item, status: 'uploading', progress: 50 } : item
      ))
      try {
        await uploadTrack(items[i].file, user.id)
        setItems(prev => prev.map((item, idx) =>
          idx === i ? { ...item, status: 'done', progress: 100 } : item
        ))
      } catch (err: any) {
        setItems(prev => prev.map((item, idx) =>
          idx === i ? { ...item, status: 'error', error: err.message } : item
        ))
      }
    }
    onComplete()
    onClose()
  }

  const removeItem = (idx: number) => {
    setItems(prev => prev.filter((_, i) => i !== idx))
  }

  const hasPending = items.some(i => i.status === 'pending')
  const isUploading = items.some(i => i.status === 'uploading')

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-lg max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-zinc-800">
          <h2 className="text-lg font-semibold">Upload Tracks</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <div className="p-4 flex-1 overflow-auto">
          {/* Drop zone */}
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => {
              const input = document.createElement('input')
              input.type = 'file'
              input.multiple = true
              input.accept = 'audio/*'
              input.onchange = () => input.files && addFiles(input.files)
              input.click()
            }}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              dragging ? 'border-indigo-500 bg-indigo-500/10' : 'border-zinc-700 hover:border-zinc-500'
            }`}
          >
            <Upload className="mx-auto mb-3 text-zinc-500" size={32} />
            <p className="text-sm text-zinc-300">Drop audio files here or click to browse</p>
            <p className="text-xs text-zinc-500 mt-1">MP3, AIFF, FLAC, M4A, WAV</p>
            <p className="text-xs text-amber-400 mt-2 font-medium">MP3 & AIFF recommended — metadata is preserved</p>
          </div>

          {/* File list */}
          {items.length > 0 && (
            <div className="mt-4 space-y-2">
              {items.map((item, idx) => (
                <div key={idx} className="flex items-center gap-3 bg-zinc-800 rounded-lg px-3 py-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{item.file.name}</p>
                    <p className="text-xs text-zinc-500">{(item.file.size / 1024 / 1024).toFixed(1)} MB</p>
                  </div>
                  {item.status === 'pending' && (
                    <button onClick={() => removeItem(idx)} className="text-zinc-500 hover:text-white">
                      <X size={16} />
                    </button>
                  )}
                  {item.status === 'uploading' && <Loader2 size={16} className="text-indigo-400 animate-spin" />}
                  {item.status === 'done' && <CheckCircle size={16} className="text-green-400" />}
                  {item.status === 'error' && (
                    <span title={item.error}><AlertCircle size={16} className="text-red-400" /></span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {items.length > 0 && (
          <div className="p-4 border-t border-zinc-800">
            <button
              onClick={startUpload}
              disabled={!hasPending || isUploading}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg transition-colors"
            >
              {isUploading ? 'Uploading...' : `Upload ${items.filter(i => i.status === 'pending').length} file(s)`}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
