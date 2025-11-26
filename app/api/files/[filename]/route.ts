import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'

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

    // Check if file exists
    try {
      await fs.access(filePath)
    } catch {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      )
    }

    // Read file
    const fileBuffer = await fs.readFile(filePath)
    const stats = await fs.stat(filePath)

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

    // Return file with appropriate headers
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': stats.size.toString(),
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

