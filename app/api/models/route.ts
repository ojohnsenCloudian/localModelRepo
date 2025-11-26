import { NextResponse } from 'next/server'
import * as fs from 'fs/promises'
import * as path from 'path'

const MODELS_DIR = process.env.MODELS_DIR || '/app/models'

export async function GET() {
  try {
    console.log(`Listing models from MODELS_DIR: ${MODELS_DIR}`)
    console.log(`MODELS_DIR env var: ${process.env.MODELS_DIR}`)
    
    // Check if models directory exists
    try {
      await fs.access(MODELS_DIR)
      console.log(`Directory ${MODELS_DIR} exists`)
    } catch (error: any) {
      // Directory doesn't exist, return empty array
      console.error(`Directory ${MODELS_DIR} does not exist:`, error.message)
      return NextResponse.json([])
    }

    // Read directory contents
    const files = await fs.readdir(MODELS_DIR)
    console.log(`Found ${files.length} items in directory: ${files.join(', ')}`)

    // Get file stats for each file
    const models = await Promise.all(
      files.map(async (filename) => {
        try {
          const filePath = path.join(MODELS_DIR, filename)
          const stats = await fs.stat(filePath)

          // Only return files, not directories
          if (stats.isFile()) {
            return {
              filename,
              size: stats.size,
              sizeFormatted: formatBytes(stats.size),
              modified: stats.mtime.toISOString(),
              downloadUrl: `/api/models/${encodeURIComponent(filename)}`,
            }
          }
          return null
        } catch (error) {
          console.error(`Error reading file ${filename}:`, error)
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

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
}

