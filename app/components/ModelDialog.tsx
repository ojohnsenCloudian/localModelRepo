'use client'

import { useEffect, useState } from 'react'
import { Copy, Check } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'

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
  const { toast } = useToast()

  useEffect(() => {
    if (model) {
      const downloadUrl = `${serverUrl}/api/files/${encodeURIComponent(model.filename)}`
      setWgetCommand(`wget ${downloadUrl}`)
    }
  }, [model, serverUrl])

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(wgetCommand)
      setCopied(true)
      toast({
        title: "Copied!",
        description: "Wget command copied to clipboard",
      })
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      toast({
        title: "Failed to copy",
        description: "Please copy the command manually",
        variant: "destructive",
      })
    }
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
    <Dialog open={!!model} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Model Details</DialogTitle>
          <DialogDescription>
            View model information and download command
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Filename</label>
            <p className="text-sm font-mono break-all bg-muted p-2 rounded-md">{model.filename}</p>
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Size</label>
            <p className="text-sm">{formatSize(model.size)}</p>
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Downloaded At</label>
            <p className="text-sm">{new Date(model.downloadedAt).toLocaleString()}</p>
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Wget Command</label>
            <div className="flex gap-2">
              <code className="flex-1 bg-muted p-3 rounded-md text-sm font-mono break-all overflow-x-auto">
                {wgetCommand}
              </code>
              <Button
                onClick={copyToClipboard}
                variant="outline"
                size="icon"
                className="shrink-0"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
