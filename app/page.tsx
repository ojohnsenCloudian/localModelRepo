'use client'

import { useState } from 'react'
import { Download, CheckCircle2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { ThemeToggle } from '@/components/theme-toggle'
import ModelLibrary from './components/ModelLibrary'
import { useToast } from '@/hooks/use-toast'

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

  const handleDownload = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!url.trim()) {
      toast({
        title: "Invalid URL",
        description: "Please enter a valid Hugging Face URL",
        variant: "destructive",
      })
      return
    }

    setDownloading(true)
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
                toast({
                  title: "Download failed",
                  description: data.error,
                  variant: "destructive",
                })
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
                toast({
                  title: "Download complete",
                  description: data.message || 'Model downloaded successfully!',
                })
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
      toast({
        title: "Download failed",
        description: error.message || 'Failed to download model. Please check the URL and try again.',
        variant: "destructive",
      })
      setDownloading(false)
      setDownloadProgress(null)
    }
  }

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
            <CardTitle>Download Model from Hugging Face</CardTitle>
            <CardDescription>
              Enter a direct download URL from Hugging Face to add it to your repository
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleDownload} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="url" className="text-sm font-medium">
                  Hugging Face URL
                </label>
                <Input
                  type="url"
                  id="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://huggingface.co/Comfy-Org/Qwen-Image_ComfyUI/resolve/main/split_files/vae/qwen_image_vae.safetensors"
                  disabled={downloading}
                  className="font-mono text-sm"
                />
              </div>
              <Button
                type="submit"
                disabled={downloading || !url.trim()}
                className="w-full"
                size="lg"
              >
                <Download className="mr-2 h-4 w-4" />
                {downloading ? 'Downloading...' : 'Download Model'}
              </Button>
            </form>

            {downloadProgress && (downloading || downloadProgress.status === 'completed') && (
              <div className="mt-6 space-y-3">
                {downloadProgress.filename && (
                  <div className="flex items-center gap-2 text-sm">
                    {downloadProgress.status === 'completed' ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : (
                      <Download className="h-4 w-4 text-primary animate-bounce" />
                    )}
                    <span className="font-medium">{downloadProgress.filename}</span>
                  </div>
                )}
                <Progress value={downloadProgress.progress} className="h-2" />
                {downloadProgress.total > 0 && (
                  <div className="text-xs text-muted-foreground flex justify-between">
                    <span>{formatBytes(downloadProgress.loaded)}</span>
                    <span>{formatBytes(downloadProgress.total)}</span>
                  </div>
                )}
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
