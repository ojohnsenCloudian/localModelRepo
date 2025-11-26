import { NextRequest, NextResponse } from 'next/server'
import * as fs from 'fs/promises'
import * as path from 'path'
import { createWriteStream } from 'fs'

const MODELS_DIR = process.env.MODELS_DIR || '/app/models'

// Ensure models directory exists and is writable
async function ensureModelsDir() {
  try {
    await fs.mkdir(MODELS_DIR, { recursive: true })
    // Verify we can write
    const testFile = path.join(MODELS_DIR, '.write-test')
    await fs.writeFile(testFile, 'test')
    await fs.unlink(testFile)
    return true
  } catch (error: any) {
    console.error('Cannot write to models directory:', error.message)
    return false
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

    // Ensure directory is writable
    const canWrite = await ensureModelsDir()
    if (!canWrite) {
      return NextResponse.json(
        { error: 'Cannot write to models directory. Check volume mount and permissions.' },
        { status: 500 }
      )
    }

    // Extract filename from URL
    const urlObj = new URL(url)
    const pathParts = urlObj.pathname.split('/').filter(p => p)
    let filename = pathParts[pathParts.length - 1] || `model-${Date.now()}.bin`
    
    // Remove query parameters and clean filename
    filename = filename.split('?')[0]
    filename = filename.replace(/[^a-zA-Z0-9._-]/g, '_')
    
    if (!filename || filename === '') {
      filename = `model-${Date.now()}.bin`
    }

    const filePath = path.join(MODELS_DIR, filename)
    console.log(`[DOWNLOAD] Downloading ${url} to ${filePath}`)

    // Download file using fetch and write directly to filesystem
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ModelRepo/1.0)',
      },
    })

    if (!response.ok) {
      return NextResponse.json(
        { error: `Download failed: ${response.status} ${response.statusText}` },
        { status: response.status }
      )
    }

    // Create write stream
    const writeStream = createWriteStream(filePath)
    const reader = response.body?.getReader()
    
    if (!reader) {
      writeStream.close()
      return NextResponse.json(
        { error: 'No response body' },
        { status: 500 }
      )
    }

    let downloadedBytes = 0
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        
        await new Promise<void>((resolve, reject) => {
          writeStream.write(value, (error) => {
            if (error) reject(error)
            else resolve()
          })
        })
        
        downloadedBytes += value.length
        if (downloadedBytes % (10 * 1024 * 1024) === 0) {
          console.log(`[DOWNLOAD] Downloaded ${downloadedBytes} bytes...`)
        }
      }
      
      // Close the stream
      await new Promise<void>((resolve, reject) => {
        writeStream.end(() => {
          resolve()
        })
        writeStream.on('error', reject)
      })
      
      // Verify file was written
      const stats = await fs.stat(filePath)
      console.log(`[DOWNLOAD] File written successfully: ${filePath}, size: ${stats.size} bytes`)
      
      // Force sync to ensure data is on disk
      try {
        await fs.writeFile(path.join(MODELS_DIR, '.sync'), '')
        await fs.unlink(path.join(MODELS_DIR, '.sync'))
      } catch (syncError: any) {
        // Ignore sync errors
      }
      
      return NextResponse.json({
        success: true,
        filename,
        size: stats.size,
        filePath: filePath,
        message: 'Download completed successfully',
      })
    } catch (error: any) {
      writeStream.close()
      // Clean up partial file
      try {
        await fs.unlink(filePath)
      } catch {}
      throw error
    }
  } catch (error: any) {
    console.error('[DOWNLOAD] Download error:', error)
    return NextResponse.json(
      {
        error: 'Download failed',
        details: error.message || 'Unknown error',
      },
      { status: 500 }
    )
  }
}
