import { NextResponse } from 'next/server'
import * as fs from 'fs/promises'
import * as path from 'path'

const MODELS_DIR = process.env.MODELS_DIR || '/app/models'

export async function GET() {
  try {
    console.log(`[MODELS API] Listing models from MODELS_DIR: ${MODELS_DIR}`)
    console.log(`[MODELS API] MODELS_DIR env var: ${process.env.MODELS_DIR}`)
    
    // Ensure directory exists
    try {
      await fs.mkdir(MODELS_DIR, { recursive: true })
    } catch (error: any) {
      console.error(`[MODELS API] Error creating directory:`, error.message)
    }
    
    // Check if models directory exists and is accessible
    try {
      const dirStats = await fs.stat(MODELS_DIR)
      if (!dirStats.isDirectory()) {
        console.error(`[MODELS API] ${MODELS_DIR} is not a directory`)
        return NextResponse.json([])
      }
      console.log(`[MODELS API] Directory ${MODELS_DIR} exists and is accessible`)
    } catch (error: any) {
      // Directory doesn't exist, return empty array
      console.error(`[MODELS API] Directory ${MODELS_DIR} does not exist or is not accessible:`, error.message)
      return NextResponse.json([])
    }

    // Read directory contents
    let files: string[] = []
    try {
      files = await fs.readdir(MODELS_DIR)
      console.log(`[MODELS API] Found ${files.length} items in directory: ${files.join(', ')}`)
    } catch (error: any) {
      console.error(`[MODELS API] Error reading directory:`, error.message)
      return NextResponse.json([])
    }

    // Get file stats for each file
    const models = await Promise.all(
      files.map(async (filename) => {
        try {
          const filePath = path.resolve(MODELS_DIR, filename)
          const stats = await fs.stat(filePath)

          // Only return files, not directories
          if (stats.isFile() && stats.size > 0) {
            console.log(`[MODELS API] Found file: ${filename}, size: ${stats.size} bytes`)
            return {
              filename,
              size: stats.size,
              sizeFormatted: formatBytes(stats.size),
              modified: stats.mtime.toISOString(),
              downloadUrl: `/api/models/${encodeURIComponent(filename)}`,
            }
          } else {
            console.log(`[MODELS API] Skipping ${filename} (not a file or empty)`)
          }
          return null
        } catch (error: any) {
          console.error(`[MODELS API] Error reading file ${filename}:`, error.message)
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

    console.log(`[MODELS API] Returning ${validModels.length} valid models`)
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

