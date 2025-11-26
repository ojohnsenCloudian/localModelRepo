'use client'

import { useState, useEffect } from 'react'
import { Search, Loader2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import ModelDialog from './ModelDialog'

interface Model {
  filename: string
  size: number
  downloadedAt: string
  tags?: string[]
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
        models.filter((model) => {
          const matchesFilename = model.filename.toLowerCase().includes(query)
          const matchesTags = model.tags?.some(tag => tag.toLowerCase().includes(query)) || false
          return matchesFilename || matchesTags
        })
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

  const handleTagsUpdated = () => {
    fetchModels()
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
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-4 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search models by name or tag..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="text-sm text-muted-foreground whitespace-nowrap">
          {filteredModels.length} {filteredModels.length === 1 ? 'model' : 'models'}
        </div>
      </div>

      {filteredModels.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          {searchQuery ? 'No models found matching your search.' : 'No models downloaded yet.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredModels.map((model) => (
            <Card
              key={model.filename}
              onClick={() => setSelectedModel(model)}
              className="cursor-pointer hover:shadow-lg transition-shadow"
            >
              <CardHeader>
                <CardTitle className="truncate text-base">{model.filename}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p>Size: {formatSize(model.size)}</p>
                    <p>Downloaded: {new Date(model.downloadedAt).toLocaleDateString()}</p>
                  </div>
                  {model.tags && model.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-2">
                      {model.tags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {selectedModel && (
        <ModelDialog
          model={selectedModel}
          onClose={() => setSelectedModel(null)}
          serverUrl={serverUrl}
          onTagsUpdated={handleTagsUpdated}
        />
      )}
    </div>
  )
}
