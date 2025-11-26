'use client'

import { useState, useEffect, useMemo } from 'react'

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
  const [searchQuery, setSearchQuery] = useState('')
  const [showDownloadForm, setShowDownloadForm] = useState(false)
  const [copiedCommand, setCopiedCommand] = useState<string | null>(null)

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
    // Auto-refresh every 30 seconds
    const interval = setInterval(loadModels, 30000)
    return () => clearInterval(interval)
  }, [])

  // Filter models based on search query
  const filteredModels = useMemo(() => {
    if (!searchQuery.trim()) {
      return models
    }
    const query = searchQuery.toLowerCase()
    return models.filter(model => 
      model.filename.toLowerCase().includes(query)
    )
  }, [models, searchQuery])

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
        setShowDownloadForm(false)
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

  const copyToClipboard = async (text: string, modelFilename: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedCommand(modelFilename)
      setTimeout(() => setCopiedCommand(null), 2000)
    } catch (error) {
      console.error('Failed to copy:', error)
    }
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
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const totalSize = useMemo(() => {
    return models.reduce((sum, model) => sum + model.size, 0)
  }, [models])

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold text-gray-900 mb-3">
            Model Library
          </h1>
          <p className="text-lg text-gray-600 mb-4">
            Your local Hugging Face model repository
          </p>
          <div className="flex justify-center gap-4 text-sm text-gray-500">
            <span>{models.length} {models.length === 1 ? 'model' : 'models'}</span>
            <span>•</span>
            <span>{formatBytes(totalSize)} total</span>
          </div>
        </div>

        {/* Search and Actions Bar */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="flex flex-col md:flex-row gap-4 items-center">
            <div className="flex-1 w-full">
              <div className="relative">
                <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Search models by name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
            </div>
            <button
              onClick={() => setShowDownloadForm(!showDownloadForm)}
              className="w-full md:w-auto bg-indigo-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-indigo-700 transition-colors flex items-center gap-2 justify-center"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              {showDownloadForm ? 'Cancel' : 'Download Model'}
            </button>
            <button
              onClick={loadModels}
              className="w-full md:w-auto bg-gray-100 text-gray-700 px-6 py-2 rounded-lg font-medium hover:bg-gray-200 transition-colors flex items-center gap-2 justify-center"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
          </div>

          {/* Download Form */}
          {showDownloadForm && (
            <div className="mt-6 pt-6 border-t border-gray-200">
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
                    placeholder="https://huggingface.co/model-name/resolve/main/model.safetensors"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    disabled={isDownloading}
                  />
                </div>
                <button
                  type="submit"
                  disabled={isDownloading}
                  className="w-full bg-indigo-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                  {isDownloading ? 'Downloading...' : 'Start Download'}
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
          )}
        </div>

        {/* Models Library Grid */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-2xl font-semibold text-gray-800 mb-6">
            {searchQuery ? `Search Results (${filteredModels.length})` : 'All Models'}
          </h2>

          {isLoadingModels ? (
            <div className="text-center py-12 text-gray-500">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
              <p className="mt-4">Loading models...</p>
            </div>
          ) : filteredModels.length === 0 ? (
            <div className="text-center py-12">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
              <p className="mt-4 text-gray-500">
                {searchQuery ? 'No models found matching your search.' : 'No models downloaded yet. Download a model to get started.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredModels.map((model) => {
                const wgetCommand = `wget ${hostUrl}${model.downloadUrl} -O ${model.filename}`
                return (
                  <div
                    key={model.filename}
                    className="border border-gray-200 rounded-lg p-5 hover:shadow-md transition-shadow bg-gradient-to-br from-white to-gray-50"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 truncate mb-1" title={model.filename}>
                          {model.filename}
                        </h3>
                        <p className="text-sm text-gray-500">{formatDate(model.modified)}</p>
                      </div>
                    </div>
                    
                    <div className="mb-4">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                        </svg>
                        <span className="font-medium">{model.sizeFormatted}</span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => copyToClipboard(wgetCommand, model.filename)}
                        className={`w-full text-sm px-4 py-2 rounded-lg font-medium transition-colors ${
                          copiedCommand === model.filename
                            ? 'bg-green-100 text-green-700'
                            : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
                        }`}
                      >
                        {copiedCommand === model.filename ? '✓ Copied!' : 'Copy wget Command'}
                      </button>
                      <a
                        href={model.downloadUrl}
                        download
                        className="w-full text-sm px-4 py-2 rounded-lg font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors text-center"
                      >
                        Direct Download
                      </a>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
