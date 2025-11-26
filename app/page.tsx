'use client'

import { useState, useEffect } from 'react'

interface Model {
  filename: string
  size: number
  sizeFormatted: string
  modified: string
  downloadUrl: string
}

export default function Home() {
  const [url, setUrl] = useState('')
  const [isDownloading, setIsDownloading] = useState(false)
  const [downloadMessage, setDownloadMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [models, setModels] = useState<Model[]>([])
  const [isLoadingModels, setIsLoadingModels] = useState(true)
  const [hostUrl, setHostUrl] = useState('')

  // Get host URL for wget commands
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const protocol = window.location.protocol
      const hostname = window.location.hostname
      const port = window.location.port || '8900'
      setHostUrl(`${protocol}//${hostname}:${port}`)
    }
  }, [])

  // Load models on mount and after downloads
  const loadModels = async () => {
    try {
      setIsLoadingModels(true)
      const response = await fetch('/api/models')
      if (response.ok) {
        const data = await response.json()
        setModels(data)
      } else {
        console.error('Failed to load models')
      }
    } catch (error) {
      console.error('Error loading models:', error)
    } finally {
      setIsLoadingModels(false)
    }
  }

  useEffect(() => {
    loadModels()
  }, [])

  const handleDownload = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!url.trim()) {
      setDownloadMessage({ type: 'error', text: 'Please enter a URL' })
      return
    }

    setIsDownloading(true)
    setDownloadMessage(null)

    try {
      const response = await fetch('/api/download', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: url.trim() }),
      })

      const data = await response.json()

      if (response.ok) {
        setDownloadMessage({
          type: 'success',
          text: `Successfully downloaded: ${data.filename} (${formatBytes(data.size)})`,
        })
        setUrl('')
        // Reload models list
        await loadModels()
      } else {
        setDownloadMessage({
          type: 'error',
          text: data.error || 'Download failed',
        })
      }
    } catch (error: any) {
      setDownloadMessage({
        type: 'error',
        text: error.message || 'Download failed',
      })
    } finally {
      setIsDownloading(false)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      // You could add a toast notification here
    })
  }

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
  }

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString)
    return date.toLocaleString()
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Hugging Face Model Repository
          </h1>
          <p className="text-gray-600">
            Download and manage Hugging Face models locally
          </p>
        </div>

        {/* Download Section */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">
            Download Model
          </h2>
          <form onSubmit={handleDownload} className="space-y-4">
            <div>
              <label htmlFor="url" className="block text-sm font-medium text-gray-700 mb-2">
                Hugging Face Model URL
              </label>
              <input
                type="text"
                id="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://huggingface.co/..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                disabled={isDownloading}
              />
            </div>
            <button
              type="submit"
              disabled={isDownloading}
              className="w-full bg-indigo-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {isDownloading ? 'Downloading...' : 'Download Model'}
            </button>
          </form>

          {downloadMessage && (
            <div
              className={`mt-4 p-4 rounded-lg ${
                downloadMessage.type === 'success'
                  ? 'bg-green-50 text-green-800 border border-green-200'
                  : 'bg-red-50 text-red-800 border border-red-200'
              }`}
            >
              {downloadMessage.text}
            </div>
          )}
        </div>

        {/* Models List Section */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-semibold text-gray-800">
              Downloaded Models
            </h2>
            <button
              onClick={loadModels}
              className="text-indigo-600 hover:text-indigo-700 font-medium"
            >
              Refresh
            </button>
          </div>

          {isLoadingModels ? (
            <div className="text-center py-8 text-gray-500">Loading models...</div>
          ) : models.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No models downloaded yet. Download a model to get started.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Filename</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Size</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Modified</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {models.map((model) => {
                    const wgetCommand = `wget ${hostUrl}${model.downloadUrl} -O ${model.filename}`
                    return (
                      <tr key={model.filename} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4">
                          <code className="text-sm text-gray-800 bg-gray-100 px-2 py-1 rounded">
                            {model.filename}
                          </code>
                        </td>
                        <td className="py-3 px-4 text-gray-600">{model.sizeFormatted}</td>
                        <td className="py-3 px-4 text-gray-600 text-sm">
                          {formatDate(model.modified)}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex flex-col gap-2">
                            <button
                              onClick={() => copyToClipboard(wgetCommand)}
                              className="text-xs bg-indigo-100 text-indigo-700 px-3 py-1 rounded hover:bg-indigo-200 transition-colors"
                            >
                              Copy wget Command
                            </button>
                            <a
                              href={model.downloadUrl}
                              download
                              className="text-xs bg-green-100 text-green-700 px-3 py-1 rounded hover:bg-green-200 transition-colors text-center"
                            >
                              Direct Download
                            </a>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {models.length > 0 && (
            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-2">
                <strong>Tip:</strong> Click "Copy wget Command" to copy the command to your clipboard, then paste it into your terminal to download the model.
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}

