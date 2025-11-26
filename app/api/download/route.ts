import { NextRequest } from 'next/server'
import fs from 'fs/promises'
import path from 'path'
import { createWriteStream } from 'fs'

const MODELS_DIR = path.join(process.cwd(), 'models')

// Ensure models directory exists
async function ensureModelsDir() {
  try {
    await fs.access(MODELS_DIR)
    console.log(`Models directory exists: ${MODELS_DIR}`)
  } catch {
    await fs.mkdir(MODELS_DIR, { recursive: true })
    console.log(`Created models directory: ${MODELS_DIR}`)
  }
  
  // Verify we can write to the directory
  try {
    const testFile = path.join(MODELS_DIR, '.test-write')
    await fs.writeFile(testFile, 'test')
    await fs.unlink(testFile)
    console.log(`Models directory is writable: ${MODELS_DIR}`)
  } catch (error) {
    console.error(`Cannot write to models directory: ${MODELS_DIR}`, error)
    throw new Error(`Cannot write to models directory: ${error}`)
  }
}

// Helper to send SSE message
function sendSSE(controller: ReadableStreamDefaultController, data: any) {
  const message = `data: ${JSON.stringify(data)}\n\n`
  controller.enqueue(new TextEncoder().encode(message))
}

export async function POST(request: NextRequest) {
  const stream = new ReadableStream({
    async start(controller) {
      
      try {
        const { url } = await request.json()

        if (!url || typeof url !== 'string') {
          sendSSE(controller, { error: 'URL is required' })
          controller.close()
          return
        }

        // Validate Hugging Face URL
        if (!url.includes('huggingface.co')) {
          sendSSE(controller, { error: 'Invalid Hugging Face URL' })
          controller.close()
          return
        }

        await ensureModelsDir()

        // Extract filename from URL
        const urlParts = url.split('/')
        const filename = urlParts[urlParts.length - 1].split('?')[0] // Remove query params
        
        if (!filename) {
          sendSSE(controller, { error: 'Could not extract filename from URL' })
          controller.close()
          return
        }

        const filePath = path.join(MODELS_DIR, filename)
        console.log(`Downloading to: ${filePath}`)

        // Check if file already exists
        try {
          await fs.access(filePath)
          sendSSE(controller, { error: 'Model already exists', filename })
          controller.close()
          return
        } catch {
          // File doesn't exist, proceed with download
        }

        // Send initial progress
        sendSSE(controller, { 
          status: 'starting', 
          filename,
          progress: 0,
          loaded: 0,
          total: 0
        })

        // Download the file
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; LocalModelRepo/1.0)',
          },
        })

        if (!response.ok) {
          sendSSE(controller, { 
            error: `Failed to download file: ${response.statusText}` 
          })
          controller.close()
          return
        }

        // Get content length for progress tracking
        const contentLength = response.headers.get('content-length')
        const totalSize = contentLength ? parseInt(contentLength, 10) : 0

        if (!response.body) {
          sendSSE(controller, { error: 'No response body' })
          controller.close()
          return
        }

        // Create write stream
        const writeStream = createWriteStream(filePath)
        const reader = response.body.getReader()
        let downloadedBytes = 0
        let lastProgressUpdate = 0
        const progressUpdateInterval = 1024 * 1024 // Update every 1MB

        // Stream the file to disk with progress tracking
        while (true) {
          const { done, value } = await reader.read()
          
          if (done) {
            writeStream.end()
            break
          }

          writeStream.write(value)
          downloadedBytes += value.length

          // Send progress update every 1MB or on completion
          if (downloadedBytes - lastProgressUpdate >= progressUpdateInterval || done) {
            const progress = totalSize > 0 
              ? Math.round((downloadedBytes / totalSize) * 100) 
              : 0

            sendSSE(controller, {
              status: 'downloading',
              filename,
              progress,
              loaded: downloadedBytes,
              total: totalSize
            })
            
            lastProgressUpdate = downloadedBytes
          }
        }

        // Wait for write stream to finish
        await new Promise<void>((resolve, reject) => {
          writeStream.on('finish', () => {
            console.log(`File write completed: ${filePath}`)
            resolve()
          })
          writeStream.on('error', (error) => {
            console.error(`File write error for ${filePath}:`, error)
            reject(error)
          })
        })

        // Get file stats
        const stats = await fs.stat(filePath)
        console.log(`File saved successfully: ${filePath}, size: ${stats.size} bytes`)

        // Send completion message
        sendSSE(controller, {
          status: 'completed',
          message: 'Model downloaded successfully',
          filename,
          size: stats.size,
          downloadedAt: new Date().toISOString(),
          progress: 100,
          loaded: stats.size,
          total: stats.size
        })

        controller.close()
      } catch (error: any) {
        console.error('Download error:', error)
        sendSSE(controller, { 
          error: error.message || 'Failed to download model' 
        })
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}

