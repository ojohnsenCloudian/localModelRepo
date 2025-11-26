import { NextRequest, NextResponse } from 'next/server'
import * as fs from 'fs/promises'
import * as path from 'path'
import { createReadStream } from 'fs'

const MODELS_DIR = process.env.MODELS_DIR || '/app/models'

function getContentType(ext: string): string {
  const contentTypes: Record<string, string> = {
    '.bin': 'application/octet-stream',
    '.safetensors': 'application/octet-stream',
    '.pt': 'application/octet-stream',
    '.pth': 'application/octet-stream',
    '.onnx': 'application/octet-stream',
    '.json': 'application/json',
    '.txt': 'text/plain',
    '.md': 'text/markdown',
    '.yml': 'text/yaml',
    '.yaml': 'text/yaml',
  }
  return contentTypes[ext] || 'application/octet-stream'
}

export async function GET(
  request: NextRequest,
  { params }: { params: { filename: string } }
) {
  try {
    const filename = decodeURIComponent(params.filename)

    // Security: prevent directory traversal
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return NextResponse.json(
        { error: 'Invalid filename' },
        { status: 400 }
      )
    }

    const filePath = path.join(MODELS_DIR, filename)

    // Check if file exists
    let stats
    try {
      stats = await fs.stat(filePath)
      if (!stats.isFile()) {
        return NextResponse.json(
          { error: 'Not a file' },
          { status: 400 }
        )
      }
    } catch {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      )
    }

    // Determine content type
    const ext = path.extname(filename).toLowerCase()
    const contentType = getContentType(ext)

    // Create read stream and return as response
    const readStream = createReadStream(filePath)
    
    return new NextResponse(readStream as any, {
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
      { error: 'Failed to serve file', details: error.message },
      { status: 500 }
    )
  }
}
