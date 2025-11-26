import { NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'
import { getModelTags } from './metadata'

// Use absolute path to match Docker volume mount
const MODELS_DIR = '/app/models'

export async function GET() {
  try {
    console.log(`Checking models directory: ${MODELS_DIR}`)
    // Check if models directory exists
    try {
      await fs.access(MODELS_DIR)
      console.log(`Models directory exists: ${MODELS_DIR}`)
    } catch (error) {
      console.log(`Models directory does not exist: ${MODELS_DIR}`, error)
      return NextResponse.json({ models: [] })
    }

    // Read all files in models directory
    const files = await fs.readdir(MODELS_DIR)
    console.log(`Found ${files.length} files in models directory:`, files)
    
    // Filter out metadata file and hidden files
    const modelFiles = files.filter(filename => 
      filename !== '.metadata.json' && 
      !filename.startsWith('.') &&
      filename !== 'models' // Exclude the nested models directory if it exists
    )
    
    const models = await Promise.all(
      modelFiles.map(async (filename) => {
        const filePath = path.join(MODELS_DIR, filename)
        try {
          const stats = await fs.stat(filePath)
          if (stats.isFile()) {
            const tags = await getModelTags(filename)
            return {
              filename,
              size: stats.size,
              downloadedAt: stats.mtime.toISOString(),
              tags,
            }
          }
          return null
        } catch {
          return null
        }
      })
    )

    // Filter out null values and sort by downloaded date (newest first)
    const validModels = models
      .filter((model): model is NonNullable<typeof model> => model !== null)
      .sort((a, b) => new Date(b.downloadedAt).getTime() - new Date(a.downloadedAt).getTime())

    return NextResponse.json({ models: validModels })
  } catch (error: any) {
    console.error('Error listing models:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to list models' },
      { status: 500 }
    )
  }
}

