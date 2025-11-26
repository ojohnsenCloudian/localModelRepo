import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'
import { createReadStream } from 'fs'

// Use absolute path to match Docker volume mount
const MODELS_DIR = '/app/models'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename: filenameParam } = await params
    const filename = decodeURIComponent(filenameParam)
    
    // Security: prevent directory traversal
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return NextResponse.json(
        { error: 'Invalid filename' },
        { status: 400 }
      )
    }

    const filePath = path.join(MODELS_DIR, filename)

    // Check if file exists and get stats
    let stats
    try {
      stats = await fs.stat(filePath)
    } catch {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      )
    }

    // Determine content type
    const ext = path.extname(filename).toLowerCase()
    const contentTypes: Record<string, string> = {
      '.safetensors': 'application/octet-stream',
      '.pt': 'application/octet-stream',
      '.pth': 'application/octet-stream',
      '.ckpt': 'application/octet-stream',
      '.bin': 'application/octet-stream',
      '.json': 'application/json',
      '.txt': 'text/plain',
    }
    const contentType = contentTypes[ext] || 'application/octet-stream'

    // Handle Range requests for resumable downloads
    const range = request.headers.get('range')
    
    if (range) {
      // Parse range header (e.g., "bytes=0-1023")
      const parts = range.replace(/bytes=/, '').split('-')
      const start = parseInt(parts[0], 10)
      const end = parts[1] ? parseInt(parts[1], 10) : stats.size - 1
      const chunkSize = (end - start) + 1

      // Validate range
      if (start >= stats.size || end >= stats.size || start > end) {
        return NextResponse.json(
          { error: 'Range not satisfiable' },
          { status: 416 }
        )
      }

      // Create read stream for the requested range
      const readStream = createReadStream(filePath, { start, end })
      
      return new NextResponse(readStream as any, {
        status: 206, // Partial Content
        headers: {
          'Content-Type': contentType,
          'Content-Length': chunkSize.toString(),
          'Content-Range': `bytes ${start}-${end}/${stats.size}`,
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'public, max-age=3600',
        },
      })
    }

    // Stream the entire file for non-range requests
    // This prevents loading large files into memory
    const readStream = createReadStream(filePath)
    
    return new NextResponse(readStream as any, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': stats.size.toString(),
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=3600',
      },
    })
  } catch (error: any) {
    console.error('Error serving file:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to serve file' },
      { status: 500 }
    )
  }
}
