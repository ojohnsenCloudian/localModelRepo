'use client'

import { useState } from 'react'
import ModelLibrary from './components/ModelLibrary'

interface DownloadProgress {
  status: 'starting' | 'downloading' | 'completed'
  filename?: string
  progress: number
  loaded: number
  total: number
  message?: string
  error?: string
}

export default function Home() {
  const [url, setUrl] = useState('')
  const [downloading, setDownloading] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  
  // Get server URL - use window.location.origin in browser, fallback for SSR
  const serverUrl = typeof window !== 'undefined' ? window.location.origin : ''

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  const handleDownload = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!url.trim()) {
      setMessage({ type: 'error', text: 'Please enter a valid Hugging Face URL' })
      return
    }

    setDownloading(true)
    setMessage(null)
    setDownloadProgress({ status: 'starting', progress: 0, loaded: 0, total: 0 })

    try {
      const response = await fetch(`${serverUrl}/api/download`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: url.trim() }),
      })

      if (!response.ok) {
        throw new Error('Failed to start download')
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) {
        throw new Error('No response body')
      }

      while (true) {
        const { done, value } = await reader.read()
        
        if (done) {
          break
        }

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              
              if (data.error) {
                setMessage({ type: 'error', text: data.error })
                setDownloading(false)
                setDownloadProgress(null)
                return
              }

              setDownloadProgress({
                status: data.status,
                filename: data.filename,
                progress: data.progress || 0,
                loaded: data.loaded || 0,
                total: data.total || 0,
                message: data.message,
              })

              if (data.status === 'completed') {
                setMessage({ type: 'success', text: data.message || 'Model downloaded successfully!' })
                setUrl('')
                // Keep progress bar visible for a moment, then hide and refresh
                setTimeout(() => {
                  setDownloading(false)
                  setDownloadProgress(null)
                  // Refresh model library
                  window.location.reload()
                }, 2000)
              }
            } catch (parseError) {
              console.error('Failed to parse SSE data:', parseError)
            }
          }
        }
      }
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error.message || 'Failed to download model. Please check the URL and try again.'
      })
      setDownloading(false)
      setDownloadProgress(null)
    }
  }

  return (
    <main className="min-h-screen p-8 bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-8">
          Local Model Repository
        </h1>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
            Download Model from Hugging Face
          </h2>
          <form onSubmit={handleDownload} className="space-y-4">
            <div>
              <label htmlFor="url" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Hugging Face URL
              </label>
              <input
                type="url"
                id="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://huggingface.co/Comfy-Org/Qwen-Image_ComfyUI/resolve/main/split_files/vae/qwen_image_vae.safetensors"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={downloading}
              />
            </div>
            <button
              type="submit"
              disabled={downloading || !url.trim()}
              className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-medium"
            >
              {downloading ? 'Downloading...' : 'Download Model'}
            </button>
          </form>

          {downloadProgress && (downloading || downloadProgress.status === 'completed') && (
            <div className="mt-4 space-y-2">
              {downloadProgress.filename && (
                <div className="text-sm text-gray-700 dark:text-gray-300">
                  {downloadProgress.status === 'completed' ? 'Downloaded: ' : 'Downloading: '}
                  <span className="font-medium">{downloadProgress.filename}</span>
                </div>
              )}
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4 overflow-hidden">
                <div
                  className={`h-4 rounded-full transition-all duration-300 ease-out flex items-center justify-center ${
                    downloadProgress.status === 'completed' 
                      ? 'bg-green-600' 
                      : 'bg-blue-600'
                  }`}
                  style={{ width: `${downloadProgress.progress}%` }}
                >
                  {downloadProgress.progress > 10 && (
                    <span className="text-xs text-white font-medium">
                      {downloadProgress.progress}%
                    </span>
                  )}
                </div>
              </div>
              {downloadProgress.total > 0 && (
                <div className="text-xs text-gray-600 dark:text-gray-400 flex justify-between">
                  <span>{formatBytes(downloadProgress.loaded)}</span>
                  <span>{formatBytes(downloadProgress.total)}</span>
                </div>
              )}
            </div>
          )}

          {message && (
            <div
              className={`mt-4 p-4 rounded-lg ${
                message.type === 'success'
                  ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                  : 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
              }`}
            >
              {message.text}
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
            Model Library
          </h2>
          <ModelLibrary serverUrl={serverUrl} />
        </div>
      </div>
    </main>
  )
}

