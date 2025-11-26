'use client'

import { useEffect, useState } from 'react'

interface ModelDialogProps {
  model: {
    filename: string
    size: number
    downloadedAt: string
  } | null
  onClose: () => void
  serverUrl: string
}

export default function ModelDialog({ model, onClose, serverUrl }: ModelDialogProps) {
  const [wgetCommand, setWgetCommand] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (model) {
      const downloadUrl = `${serverUrl}/api/files/${encodeURIComponent(model.filename)}`
      setWgetCommand(`wget ${downloadUrl}`)
    }
  }, [model, serverUrl])

  const copyToClipboard = () => {
    navigator.clipboard.writeText(wgetCommand)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (!model) return null

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-2xl w-full mx-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Model Details</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Filename</label>
            <p className="text-gray-900 dark:text-white break-all">{model.filename}</p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Size</label>
            <p className="text-gray-900 dark:text-white">{formatSize(model.size)}</p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Downloaded At</label>
            <p className="text-gray-900 dark:text-white">{new Date(model.downloadedAt).toLocaleString()}</p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Wget Command</label>
            <div className="flex gap-2">
              <code className="flex-1 bg-gray-100 dark:bg-gray-700 p-3 rounded text-sm text-gray-900 dark:text-white break-all">
                {wgetCommand}
              </code>
              <button
                onClick={copyToClipboard}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

