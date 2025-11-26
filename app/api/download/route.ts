import { NextRequest, NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import * as fs from 'fs/promises'
import * as path from 'path'

const execAsync = promisify(exec)

const MODELS_DIR = process.env.MODELS_DIR || '/app/models'

// Ensure models directory exists
async function ensureModelsDir() {
  try {
    await fs.mkdir(MODELS_DIR, { recursive: true })
  } catch (error) {
    console.error('Error creating models directory:', error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json()

    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      )
    }

    // Validate Hugging Face URL
    if (!url.includes('huggingface.co')) {
      return NextResponse.json(
        { error: 'Invalid Hugging Face URL' },
        { status: 400 }
      )
    }

    await ensureModelsDir()

    // Extract filename from URL or use a default name
    const urlParts = url.split('/')
    const filename = urlParts[urlParts.length - 1] || `model-${Date.now()}`
    const filePath = path.join(MODELS_DIR, filename)

    // Use wget to download the file
    // -O specifies output file
    // --progress=dot shows progress
    // --no-check-certificate in case of SSL issues
    const wgetCommand = `wget -O "${filePath}" "${url}" --progress=dot --no-check-certificate`

    console.log(`Downloading from ${url} to ${filePath}`)

    // Execute wget
    const { stdout, stderr } = await execAsync(wgetCommand, {
      maxBuffer: 1024 * 1024 * 100, // 100MB buffer
    })

    // Check if file was downloaded successfully
    try {
      const stats = await fs.stat(filePath)
      return NextResponse.json({
        success: true,
        filename,
        size: stats.size,
        message: 'Download completed successfully',
      })
    } catch (error) {
      return NextResponse.json(
        {
          error: 'Download failed - file not found',
          details: stderr || stdout,
        },
        { status: 500 }
      )
    }
  } catch (error: any) {
    console.error('Download error:', error)
    return NextResponse.json(
      {
        error: 'Download failed',
        details: error.message || 'Unknown error',
      },
      { status: 500 }
    )
  }
}

