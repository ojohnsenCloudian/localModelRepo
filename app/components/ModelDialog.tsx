'use client'

import { useEffect, useState } from 'react'
import { Copy, Check, X, Plus } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import { Badge } from '@/components/ui/badge'

interface ModelDialogProps {
  model: {
    filename: string
    size: number
    downloadedAt: string
    tags?: string[]
  } | null
  onClose: () => void
  serverUrl: string
  onTagsUpdated?: () => void
}

export default function ModelDialog({ model, onClose, serverUrl, onTagsUpdated }: ModelDialogProps) {
  const [wgetCommand, setWgetCommand] = useState('')
  const [copied, setCopied] = useState(false)
  const [tags, setTags] = useState<string[]>([])
  const [newTag, setNewTag] = useState('')
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    if (model) {
      const downloadUrl = `${serverUrl}/api/files/${encodeURIComponent(model.filename)}`
      setWgetCommand(`wget ${downloadUrl}`)
      setTags(model.tags || [])
      setNewTag('')
    }
  }, [model, serverUrl])

  const fetchTags = async () => {
    if (!model) return
    try {
      const response = await fetch(`${serverUrl}/api/models/tags?filename=${encodeURIComponent(model.filename)}`)
      if (response.ok) {
        const data = await response.json()
        setTags(data.tags || [])
      }
    } catch (error) {
      console.error('Failed to fetch tags:', error)
    }
  }

  useEffect(() => {
    if (model) {
      fetchTags()
    }
  }, [model, serverUrl])

  const copyToClipboard = async () => {
    const textToCopy = wgetCommand || ''
    
    if (!textToCopy) {
      toast({
        title: "Nothing to copy",
        description: "Wget command is not available",
        variant: "destructive",
      })
      return
    }

    try {
      // Method 1: Try modern clipboard API (works in secure contexts like HTTPS)
      if (navigator.clipboard && navigator.clipboard.writeText) {
        try {
          await navigator.clipboard.writeText(textToCopy)
          setCopied(true)
          toast({
            title: "Copied!",
            description: "Wget command copied to clipboard",
          })
          setTimeout(() => setCopied(false), 2000)
          return
        } catch (clipboardError) {
          console.log('Clipboard API failed, trying fallback:', clipboardError)
          // Fall through to fallback method
        }
      }
      
      // Method 2: Fallback using execCommand (works in HTTP and older browsers)
      const textArea = document.createElement('textarea')
      textArea.value = textToCopy
      textArea.style.position = 'fixed'
      textArea.style.left = '0'
      textArea.style.top = '0'
      textArea.style.width = '2em'
      textArea.style.height = '2em'
      textArea.style.padding = '0'
      textArea.style.border = 'none'
      textArea.style.outline = 'none'
      textArea.style.boxShadow = 'none'
      textArea.style.background = 'transparent'
      textArea.style.opacity = '0'
      textArea.style.zIndex = '-1'
      
      document.body.appendChild(textArea)
      textArea.focus()
      textArea.select()
      
      // For iOS
      if (navigator.userAgent.match(/ipad|iphone/i)) {
        const range = document.createRange()
        range.selectNodeContents(textArea)
        const selection = window.getSelection()
        if (selection) {
          selection.removeAllRanges()
          selection.addRange(range)
        }
        textArea.setSelectionRange(0, 999999)
      }
      
      const successful = document.execCommand('copy')
      document.body.removeChild(textArea)
      
      if (successful) {
        setCopied(true)
        toast({
          title: "Copied!",
          description: "Wget command copied to clipboard",
        })
        setTimeout(() => setCopied(false), 2000)
      } else {
        throw new Error('execCommand returned false')
      }
    } catch (error) {
      console.error('All copy methods failed:', error)
      
      // Method 3: Last resort - select the text in the visible code element
      try {
        const codeElement = document.getElementById('wget-command')
        if (codeElement) {
          // Create a temporary selection
          const range = document.createRange()
          range.selectNodeContents(codeElement)
          const selection = window.getSelection()
          if (selection) {
            selection.removeAllRanges()
            selection.addRange(range)
          }
          
          // Try one more time with the selected text
          const selectedText = selection.toString()
          if (selectedText) {
            try {
              await navigator.clipboard.writeText(selectedText)
              setCopied(true)
              toast({
                title: "Copied!",
                description: "Wget command copied to clipboard",
              })
              setTimeout(() => setCopied(false), 2000)
              return
            } catch {
              // Continue to manual copy message
            }
          }
          
          toast({
            title: "Text selected",
            description: "Text is selected - press Ctrl+C (or Cmd+C on Mac) to copy",
          })
        } else {
          throw new Error('Code element not found')
        }
      } catch (selectError) {
        console.error('Selection fallback failed:', selectError)
        toast({
          title: "Copy failed",
          description: `Please manually copy: ${textToCopy.substring(0, 50)}...`,
          variant: "destructive",
        })
      }
    }
  }

  const addTag = async () => {
    if (!model || !newTag.trim()) return
    
    const tagToAdd = newTag.trim().toLowerCase()
    if (tags.includes(tagToAdd)) {
      toast({
        title: "Tag already exists",
        description: "This tag is already added to the model",
        variant: "destructive",
      })
      setNewTag('')
      return
    }

    setLoading(true)
    try {
      const updatedTags = [...tags, tagToAdd]
      const response = await fetch(`${serverUrl}/api/models/tags`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filename: model.filename,
          tags: updatedTags,
        }),
      })

      if (response.ok) {
        setTags(updatedTags)
        setNewTag('')
        toast({
          title: "Tag added",
          description: "Tag has been added successfully",
        })
        onTagsUpdated?.()
      } else {
        throw new Error('Failed to add tag')
      }
    } catch (error) {
      toast({
        title: "Failed to add tag",
        description: "Please try again",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const removeTag = async (tagToRemove: string) => {
    if (!model) return

    setLoading(true)
    try {
      const updatedTags = tags.filter(tag => tag !== tagToRemove)
      const response = await fetch(`${serverUrl}/api/models/tags`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filename: model.filename,
          tags: updatedTags,
        }),
      })

      if (response.ok) {
        setTags(updatedTags)
        toast({
          title: "Tag removed",
          description: "Tag has been removed successfully",
        })
        onTagsUpdated?.()
      } else {
        throw new Error('Failed to remove tag')
      }
    } catch (error) {
      toast({
        title: "Failed to remove tag",
        description: "Please try again",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addTag()
    }
    // Allow paste and other standard operations
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
            View model information, manage tags, and download command
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
            <label className="text-sm font-medium text-muted-foreground">Tags</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="text-sm">
                  {tag}
                  <button
                    onClick={() => removeTag(tag)}
                    className="ml-2 hover:text-destructive"
                    disabled={loading}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                type="text"
                placeholder="Add tag (e.g., vae, diffusion, checkpoint)"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={loading}
                className="flex-1"
              />
              <Button
                onClick={addTag}
                disabled={loading || !newTag.trim()}
                size="icon"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Wget Command</label>
            <div className="flex gap-2">
              <code 
                id="wget-command"
                className="flex-1 bg-muted p-3 rounded-md text-sm font-mono break-all overflow-x-auto select-all cursor-text"
              >
                {wgetCommand}
              </code>
              <Button
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  copyToClipboard()
                }}
                variant="outline"
                size="icon"
                className="shrink-0"
                type="button"
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
