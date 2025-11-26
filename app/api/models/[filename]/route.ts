import { NextRequest, NextResponse } from 'next/server'
import * as fs from 'fs/promises'
import * as path from 'path'

const MODELS_DIR = process.env.MODELS_DIR || '/app/models'

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
    try {
      const stats = await fs.stat(filePath)
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

    // Read file
    const fileBuffer = await fs.readFile(filePath)

    // Determine content type based on file extension
    const ext = path.extname(filename).toLowerCase()
    const contentType = getContentType(ext)

    // Return file with appropriate headers
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': fileBuffer.length.toString(),
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

