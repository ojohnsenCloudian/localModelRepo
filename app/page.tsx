'use client'

import { useState } from 'react'
import { Download, CheckCircle2, X, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { ThemeToggle } from '@/components/theme-toggle'
import ModelLibrary from './components/ModelLibrary'
import { useToast } from '@/hooks/use-toast'

interface DownloadProgress {
  id: string
  url: string
  status: 'queued' | 'starting' | 'downloading' | 'completed' | 'error'
  filename?: string
  progress: number
  loaded: number
  total: number
  message?: string
  error?: string
}

export default function Home() {
  const [urlInputs, setUrlInputs] = useState<string[]>([''])
  const [downloads, setDownloads] = useState<Map<string, DownloadProgress>>(new Map())
  const { toast } = useToast()
  
  // Get server URL - use window.location.origin in browser, fallback for SSR
  const serverUrl = typeof window !== 'undefined' ? window.location.origin : ''

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  const addUrlInput = () => {
    setUrlInputs([...urlInputs, ''])
  }

  const removeUrlInput = (index: number) => {
    if (urlInputs.length > 1) {
      setUrlInputs(urlInputs.filter((_, i) => i !== index))
    }
  }

  const updateUrlInput = (index: number, value: string) => {
    const newInputs = [...urlInputs]
    newInputs[index] = value
    setUrlInputs(newInputs)
  }

  const downloadSingleModel = async (url: string, downloadId: string) => {
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
                setDownloads(prev => {
                  const newMap = new Map(prev)
                  const existing = newMap.get(downloadId) || { id: downloadId, url, status: 'error', progress: 0, loaded: 0, total: 0 }
                  newMap.set(downloadId, {
                    ...existing,
                    status: 'error',
                    error: data.error,
                  })
                  return newMap
                })
                return
              }

              setDownloads(prev => {
                const newMap = new Map(prev)
                const existing = newMap.get(downloadId) || { id: downloadId, url, status: 'starting', progress: 0, loaded: 0, total: 0 }
                newMap.set(downloadId, {
                  ...existing,
                  status: data.status === 'completed' ? 'completed' : data.status === 'downloading' ? 'downloading' : 'starting',
                  filename: data.filename || existing.filename,
                  progress: data.progress || 0,
                  loaded: data.loaded || 0,
                  total: data.total || 0,
                  message: data.message,
                })
                return newMap
              })

              if (data.status === 'completed') {
                toast({
                  title: "Download complete",
                  description: `${data.filename || 'Model'} downloaded successfully!`,
                })
                
                // Remove completed download after 3 seconds
                setTimeout(() => {
                  setDownloads(prev => {
                    const newMap = new Map(prev)
                    newMap.delete(downloadId)
                    return newMap
                  })
                  // Refresh model library
                  window.location.reload()
                }, 3000)
              }
            } catch (parseError) {
              console.error('Failed to parse SSE data:', parseError)
            }
          }
        }
      }
    } catch (error: any) {
      setDownloads(prev => {
        const newMap = new Map(prev)
        const existing = newMap.get(downloadId) || { id: downloadId, url, status: 'error', progress: 0, loaded: 0, total: 0 }
        newMap.set(downloadId, {
          ...existing,
          status: 'error',
          error: error.message || 'Failed to download model',
        })
        return newMap
      })
      toast({
        title: "Download failed",
        description: error.message || 'Failed to download model. Please check the URL and try again.',
        variant: "destructive",
      })
    }
  }

  const handleDownload = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Filter out empty URLs and validate
    const urlList = urlInputs
      .map(url => url.trim())
      .filter(url => url.length > 0 && url.includes('huggingface.co'))

    if (urlList.length === 0) {
      toast({
        title: "Invalid URLs",
        description: "Please enter at least one valid Hugging Face URL",
        variant: "destructive",
      })
      return
    }

    // Start all downloads
    urlList.forEach((url, index) => {
      const downloadId = `${Date.now()}-${index}`
      setDownloads(prev => {
        const newMap = new Map(prev)
        newMap.set(downloadId, {
          id: downloadId,
          url,
          status: 'queued',
          progress: 0,
          loaded: 0,
          total: 0,
        })
        return newMap
      })
      
      // Start download immediately
      downloadSingleModel(url, downloadId)
    })

    // Clear inputs after starting downloads
    setUrlInputs([''])
    toast({
      title: "Downloads started",
      description: `Started downloading ${urlList.length} model${urlList.length > 1 ? 's' : ''}`,
    })
  }

  const removeDownload = (downloadId: string) => {
    setDownloads(prev => {
      const newMap = new Map(prev)
      newMap.delete(downloadId)
      return newMap
    })
  }

  const downloadList = Array.from(downloads.values())
  const hasActiveDownloads = downloadList.length > 0
  const hasValidUrls = urlInputs.some(url => url.trim().length > 0 && url.includes('huggingface.co'))

  return (
    <main className="min-h-screen bg-background">
      <div className="container mx-auto p-6 max-w-7xl">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold tracking-tight">Local Model Repository</h1>
            <p className="text-muted-foreground mt-2">Host and manage your Hugging Face models locally</p>
          </div>
          <ThemeToggle />
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Download Models from Hugging Face</CardTitle>
            <CardDescription>
              Add one or more direct download URLs from Hugging Face to download them simultaneously
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleDownload} className="space-y-4">
              <div className="space-y-3">
                {urlInputs.map((url, index) => (
                  <div key={index} className="flex gap-2 items-center">
                    <Input
                      type="url"
                      value={url}
                      onChange={(e) => updateUrlInput(index, e.target.value)}
                      placeholder="https://huggingface.co/.../resolve/main/model.safetensors"
                      disabled={hasActiveDownloads}
                      className="font-mono text-sm flex-1"
                    />
                    {urlInputs.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeUrlInput(index)}
                        disabled={hasActiveDownloads}
                        className="shrink-0"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={addUrlInput}
                  disabled={hasActiveDownloads}
                  className="flex-1"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add More Links
                </Button>
                <Button
                  type="submit"
                  disabled={hasActiveDownloads || !hasValidUrls}
                  className="flex-1"
                  size="lg"
                >
                  <Download className="mr-2 h-4 w-4" />
                  {hasActiveDownloads ? 'Downloads in progress...' : `Download ${urlInputs.filter(u => u.trim() && u.includes('huggingface.co')).length} Model${urlInputs.filter(u => u.trim() && u.includes('huggingface.co')).length !== 1 ? 's' : ''}`}
                </Button>
              </div>
            </form>

            {downloadList.length > 0 && (
              <div className="mt-6 space-y-4">
                <h3 className="text-sm font-medium">Active Downloads ({downloadList.length})</h3>
                {downloadList.map((download) => (
                  <div key={download.id} className="space-y-2 p-4 border rounded-lg">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 text-sm">
                          {download.status === 'completed' ? (
                            <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                          ) : download.status === 'error' ? (
                            <X className="h-4 w-4 text-destructive shrink-0" />
                          ) : (
                            <Download className="h-4 w-4 text-primary animate-bounce shrink-0" />
                          )}
                          <span className="font-medium truncate">
                            {download.filename || download.url.split('/').pop() || 'Downloading...'}
                          </span>
                          {download.status === 'queued' && (
                            <span className="text-xs text-muted-foreground">(Queued)</span>
                          )}
                        </div>
                        {download.error && (
                          <p className="text-xs text-destructive mt-1">{download.error}</p>
                        )}
                      </div>
                      {(download.status === 'completed' || download.status === 'error') && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 shrink-0"
                          onClick={() => removeDownload(download.id)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                    {download.status !== 'queued' && download.status !== 'error' && (
                      <>
                        <Progress value={download.progress} className="h-2" />
                        {download.total > 0 && (
                          <div className="text-xs text-muted-foreground flex justify-between">
                            <span>{formatBytes(download.loaded)}</span>
                            <span>{formatBytes(download.total)}</span>
                            <span>{download.progress}%</span>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Model Library</CardTitle>
            <CardDescription>
              Browse and manage your downloaded models
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ModelLibrary serverUrl={serverUrl} />
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
