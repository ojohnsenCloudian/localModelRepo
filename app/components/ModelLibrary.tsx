'use client'

import { useState, useEffect } from 'react'
import ModelDialog from './ModelDialog'

interface Model {
  filename: string
  size: number
  downloadedAt: string
}

interface ModelLibraryProps {
  serverUrl: string
}

export default function ModelLibrary({ serverUrl }: ModelLibraryProps) {
  const [models, setModels] = useState<Model[]>([])
  const [filteredModels, setFilteredModels] = useState<Model[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedModel, setSelectedModel] = useState<Model | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchModels()
    const interval = setInterval(fetchModels, 5000) // Refresh every 5 seconds
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredModels(models)
    } else {
      const query = searchQuery.toLowerCase()
      setFilteredModels(
        models.filter((model) =>
          model.filename.toLowerCase().includes(query)
        )
      )
    }
  }, [searchQuery, models])

  const fetchModels = async () => {
    try {
      const response = await fetch(`${serverUrl}/api/models`)
      if (response.ok) {
        const data = await response.json()
        setModels(data.models || [])
      }
    } catch (error) {
      console.error('Failed to fetch models:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="text-gray-600 dark:text-gray-400">Loading models...</div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-4 items-center">
        <input
          type="text"
          placeholder="Search models..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <div className="text-sm text-gray-600 dark:text-gray-400">
          {filteredModels.length} {filteredModels.length === 1 ? 'model' : 'models'}
        </div>
      </div>

      {filteredModels.length === 0 ? (
        <div className="text-center py-12 text-gray-600 dark:text-gray-400">
          {searchQuery ? 'No models found matching your search.' : 'No models downloaded yet.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredModels.map((model) => (
            <div
              key={model.filename}
              onClick={() => setSelectedModel(model)}
              className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow hover:shadow-lg transition-shadow cursor-pointer border border-gray-200 dark:border-gray-700"
            >
              <h3 className="font-semibold text-gray-900 dark:text-white truncate mb-2">
                {model.filename}
              </h3>
              <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                <p>Size: {formatSize(model.size)}</p>
                <p>Downloaded: {new Date(model.downloadedAt).toLocaleDateString()}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedModel && (
        <ModelDialog
          model={selectedModel}
          onClose={() => setSelectedModel(null)}
          serverUrl={serverUrl}
        />
      )}
    </div>
  )
}

