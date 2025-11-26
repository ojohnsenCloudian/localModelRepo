import { NextResponse } from 'next/server'
import * as fs from 'fs/promises'
import * as path from 'path'

const MODELS_DIR = process.env.MODELS_DIR || '/app/models'

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
}

export async function GET() {
  try {
    // Ensure directory exists
    try {
      await fs.mkdir(MODELS_DIR, { recursive: true })
    } catch (error) {
      // Ignore if already exists
    }

    // Check if directory exists and is accessible
    try {
      const stats = await fs.stat(MODELS_DIR)
      if (!stats.isDirectory()) {
        return NextResponse.json([])
      }
    } catch (error: any) {
      console.error(`Models directory not accessible: ${error.message}`)
      return NextResponse.json([])
    }

    // Read directory contents
    let files: string[] = []
    try {
      files = await fs.readdir(MODELS_DIR)
    } catch (error: any) {
      console.error(`Error reading directory: ${error.message}`)
      return NextResponse.json([])
    }

    // Get file stats for each file
    const models = await Promise.all(
      files.map(async (filename) => {
        // Skip hidden files
        if (filename.startsWith('.')) {
          return null
        }

        try {
          const filePath = path.join(MODELS_DIR, filename)
          const stats = await fs.stat(filePath)

          // Only return files, not directories
          if (stats.isFile() && stats.size > 0) {
            return {
              filename,
              size: stats.size,
              sizeFormatted: formatBytes(stats.size),
              modified: stats.mtime.toISOString(),
              downloadUrl: `/api/models/${encodeURIComponent(filename)}`,
            }
          }
          return null
        } catch (error: any) {
          console.error(`Error reading file ${filename}: ${error.message}`)
          return null
        }
      })
    )

    // Filter out null values and sort by modified date (newest first)
    const validModels = models
      .filter((model) => model !== null)
      .sort((a, b) => {
        const dateA = new Date(a!.modified).getTime()
        const dateB = new Date(b!.modified).getTime()
        return dateB - dateA
      })

    return NextResponse.json(validModels)
  } catch (error: any) {
    console.error('Error listing models:', error)
    return NextResponse.json(
      { error: 'Failed to list models', details: error.message },
      { status: 500 }
    )
  }
}
