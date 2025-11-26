import { NextRequest } from 'next/server'
import fs from 'fs/promises'
import path from 'path'
import { createWriteStream } from 'fs'

// Use absolute path to match Docker volume mount
const MODELS_DIR = '/app/models'

// Configuration
const MAX_RETRIES = 5
const RETRY_DELAY_BASE = 3000 // 3 seconds base delay
const CHUNK_SIZE = 1024 * 1024 * 1024 // 1GB chunks
const CONNECTION_TIMEOUT = 600000 // 10 minutes per chunk
const PROGRESS_UPDATE_INTERVAL = 10 * 1024 * 1024 // Update every 10MB

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

// Sleep helper for retries
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// Download a single chunk with retry
async function downloadChunk(
  url: string,
  startByte: number,
  endByte: number,
  filePath: string,
  controller: ReadableStreamDefaultController,
  filename: string,
  chunkNumber: number,
  totalChunks: number,
  totalSize: number
): Promise<void> {
  let attempt = 0
  
  while (attempt < MAX_RETRIES) {
    try {
      attempt++
      
      if (attempt > 1) {
        sendSSE(controller, {
          status: 'retrying',
          filename,
          message: `Retrying chunk ${chunkNumber}/${totalChunks} (attempt ${attempt}/${MAX_RETRIES})`,
          progress: 0,
          loaded: startByte,
          total: endByte,
        })
        await sleep(RETRY_DELAY_BASE * Math.pow(2, attempt - 2))
      }

      // Create abort controller for timeout
      const abortController = new AbortController()
      const timeoutId = setTimeout(() => {
        abortController.abort()
      }, CONNECTION_TIMEOUT)

      const headers: HeadersInit = {
        'User-Agent': 'Mozilla/5.0 (compatible; LocalModelRepo/1.0)',
        'Range': `bytes=${startByte}-${endByte}`,
      }

      const response = await fetch(url, {
        headers,
        signal: abortController.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok && response.status !== 206) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      if (!response.body) {
        throw new Error('No response body')
      }

      // Open file in append mode with smaller buffer to reduce memory cache
      // Smaller highWaterMark = less buffering in memory
      const writeStream = createWriteStream(filePath, { 
        flags: 'a',
        highWaterMark: 64 * 1024 // 64KB buffer (default is usually 16KB, but we want smaller)
      })
      const reader = response.body.getReader()
      let chunkBytesDownloaded = 0
      let lastSync = 0
      const SYNC_INTERVAL = 50 * 1024 * 1024 // Sync every 50MB to flush buffers

      // Helper function to write chunk with backpressure handling
      const writeChunk = (chunk: Uint8Array): Promise<void> => {
        return new Promise((resolve, reject) => {
          let drainHandler: (() => void) | null = null
          let errorHandler: ((error: Error) => void) | null = null
          
          errorHandler = (error: Error) => {
            if (drainHandler) {
              writeStream.removeListener('drain', drainHandler)
            }
            if (errorHandler) {
              writeStream.removeListener('error', errorHandler)
            }
            reject(error)
          }
          writeStream.once('error', errorHandler)
          
          const canContinue = writeStream.write(chunk)
          
          if (canContinue) {
            if (errorHandler) {
              writeStream.removeListener('error', errorHandler)
            }
            resolve()
          } else {
            drainHandler = () => {
              if (errorHandler) {
                writeStream.removeListener('error', errorHandler)
              }
              resolve()
            }
            writeStream.once('drain', drainHandler)
          }
        })
      }

      // Stream chunk to disk with progress updates
      let lastProgressUpdate = 0
      while (true) {
        const { done, value } = await reader.read()
        
        if (done) {
          break
        }

        await writeChunk(value)
        chunkBytesDownloaded += value.length

        // Periodic sync to flush buffers to disk (every 50MB)
        // This helps prevent excessive buff/cache buildup
        if (chunkBytesDownloaded - lastSync >= SYNC_INTERVAL) {
          // Force flush the write stream buffers
          writeStream.uncork()
          // Open file handle to sync and flush OS buffers
          try {
            const fileHandle = await fs.open(filePath, 'r+')
            await fileHandle.sync() // Force sync to disk - clears OS buffers
            await fileHandle.close()
          } catch (syncError) {
            // Ignore sync errors, continue downloading
            console.warn(`Sync warning at ${chunkBytesDownloaded} bytes:`, syncError)
          }
          lastSync = chunkBytesDownloaded
        }

        // Send progress update every 10MB within the chunk
        if (chunkBytesDownloaded - lastProgressUpdate >= PROGRESS_UPDATE_INTERVAL) {
          const totalDownloaded = startByte + chunkBytesDownloaded
          const progress = totalSize > 0 
            ? Math.round((totalDownloaded / totalSize) * 100) 
            : 0

          sendSSE(controller, {
            status: 'downloading',
            filename,
            message: `Chunk ${chunkNumber}/${totalChunks}: ${Math.round(chunkBytesDownloaded / 1024 / 1024)}MB / ${Math.round((endByte - startByte + 1) / 1024 / 1024)}MB`,
            progress,
            loaded: totalDownloaded,
            total: totalSize,
          })
          
          lastProgressUpdate = chunkBytesDownloaded
        }
      }

      // Close write stream and force final sync to disk
      writeStream.end()
      await new Promise<void>((resolve, reject) => {
        writeStream.on('finish', async () => {
          // Force final sync to ensure all data is written to disk
          // This helps clear buffers and prevents cache buildup
          try {
            const fileHandle = await fs.open(filePath, 'r+')
            await fileHandle.sync() // Force OS to write all buffers to disk
            await fileHandle.close()
          } catch (syncError) {
            // Ignore sync errors, but log them
            console.warn(`Failed to sync file after chunk ${chunkNumber}:`, syncError)
          }
          resolve()
        })
        writeStream.on('error', reject)
      })

      // Success - chunk downloaded
      return

    } catch (error: any) {
      console.error(`Chunk ${chunkNumber} attempt ${attempt} failed:`, error)
      
      if (attempt >= MAX_RETRIES) {
        throw new Error(`Failed to download chunk ${chunkNumber} after ${MAX_RETRIES} attempts: ${error.message}`)
      }
      
      // Retry on network errors
      if (error.name === 'AbortError' || 
          error.message.includes('fetch') || 
          error.message.includes('network') ||
          error.message.includes('timeout') ||
          error.message.includes('ECONNRESET') ||
          error.message.includes('ETIMEDOUT')) {
        continue
      }
      
      throw error
    }
  }
}

// Download file in chunks
async function downloadFileInChunks(
  url: string,
  filePath: string,
  controller: ReadableStreamDefaultController,
  filename: string,
  totalSize: number
): Promise<void> {
  // Calculate number of chunks
  const totalChunks = Math.ceil(totalSize / CHUNK_SIZE)
  let downloadedBytes = 0

  sendSSE(controller, {
    status: 'starting',
    filename,
    message: `Downloading in ${totalChunks} chunk${totalChunks > 1 ? 's' : ''} of ~${Math.round(CHUNK_SIZE / 1024 / 1024)}MB each`,
    progress: 0,
    loaded: 0,
    total: totalSize,
  })

  // Download each chunk sequentially
  for (let chunkNumber = 0; chunkNumber < totalChunks; chunkNumber++) {
    const startByte = chunkNumber * CHUNK_SIZE
    const endByte = Math.min(startByte + CHUNK_SIZE - 1, totalSize - 1)
    const chunkSize = endByte - startByte + 1

    sendSSE(controller, {
      status: 'downloading',
      filename,
      message: `Downloading chunk ${chunkNumber + 1}/${totalChunks} (${Math.round(chunkSize / 1024 / 1024)}MB)`,
      progress: totalSize > 0 ? Math.round((downloadedBytes / totalSize) * 100) : 0,
      loaded: downloadedBytes,
      total: totalSize,
    })

          await downloadChunk(
            url,
            startByte,
            endByte,
            filePath,
            controller,
            filename,
            chunkNumber + 1,
            totalChunks,
            totalSize
          )

          downloadedBytes += chunkSize

          // Small delay between chunks to let OS flush buffers
          // This prevents excessive cache buildup and keeps server healthy
          await sleep(200) // 200ms delay

          // Send progress update after each chunk
    sendSSE(controller, {
      status: 'downloading',
      filename,
      message: `Completed chunk ${chunkNumber + 1}/${totalChunks}`,
      progress: totalSize > 0 ? Math.round((downloadedBytes / totalSize) * 100) : 0,
      loaded: downloadedBytes,
      total: totalSize,
    })
  }
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
        const filename = urlParts[urlParts.length - 1].split('?')[0]
        
        if (!filename) {
          sendSSE(controller, { error: 'Could not extract filename from URL' })
          controller.close()
          return
        }

        const filePath = path.join(MODELS_DIR, filename)
        console.log(`Downloading to: ${filePath}`)

        // Check if file already exists and is complete
        try {
          const stats = await fs.stat(filePath)
          if (stats.size > 0) {
            sendSSE(controller, { error: 'Model already exists', filename })
            controller.close()
            return
          }
        } catch {
          // File doesn't exist, proceed with download
        }

        // First, get file size with HEAD request
        const headResponse = await fetch(url, {
          method: 'HEAD',
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; LocalModelRepo/1.0)',
          },
        })

        if (!headResponse.ok) {
          sendSSE(controller, { 
            error: `Failed to get file info: ${headResponse.statusText}` 
          })
          controller.close()
          return
        }

        const contentLength = headResponse.headers.get('content-length')
        const totalSize = contentLength ? parseInt(contentLength, 10) : 0

        if (totalSize === 0) {
          sendSSE(controller, { 
            error: 'Could not determine file size' 
          })
          controller.close()
          return
        }

        // Check if partial download exists and resume from last chunk
        let startChunk = 0
        let downloadedBytes = 0
        
        try {
          const stats = await fs.stat(filePath)
          downloadedBytes = stats.size
          
          if (downloadedBytes > 0 && downloadedBytes < totalSize) {
            // Calculate which chunk we're on
            startChunk = Math.floor(downloadedBytes / CHUNK_SIZE)
            sendSSE(controller, {
              status: 'resuming',
              filename,
              message: `Resuming from chunk ${startChunk + 1} (${Math.round(downloadedBytes / 1024 / 1024)}MB downloaded)`,
              progress: Math.round((downloadedBytes / totalSize) * 100),
              loaded: downloadedBytes,
              total: totalSize,
            })
          } else if (downloadedBytes >= totalSize) {
            sendSSE(controller, { error: 'Model already exists', filename })
            controller.close()
            return
          }
        } catch {
          // File doesn't exist, start from beginning
        }

        // Download file in chunks
        const totalChunks = Math.ceil(totalSize / CHUNK_SIZE)
        
        for (let chunkNumber = startChunk; chunkNumber < totalChunks; chunkNumber++) {
          const startByte = chunkNumber * CHUNK_SIZE
          const endByte = Math.min(startByte + CHUNK_SIZE - 1, totalSize - 1)
          const chunkSize = endByte - startByte + 1

          sendSSE(controller, {
            status: chunkNumber === startChunk && downloadedBytes > 0 ? 'resuming' : 'downloading',
            filename,
            message: `Downloading chunk ${chunkNumber + 1}/${totalChunks} (${Math.round(chunkSize / 1024 / 1024)}MB)`,
            progress: totalSize > 0 ? Math.round((downloadedBytes / totalSize) * 100) : 0,
            loaded: downloadedBytes,
            total: totalSize,
          })

          await downloadChunk(
            url,
            startByte,
            endByte,
            filePath,
            controller,
            filename,
            chunkNumber + 1,
            totalChunks,
            totalSize
          )

          downloadedBytes += chunkSize

          // Small delay between chunks to let OS flush buffers
          // This prevents excessive cache buildup
          await sleep(200) // 200ms delay

          // Send progress update after each chunk
          sendSSE(controller, {
            status: 'downloading',
            filename,
            message: `Completed chunk ${chunkNumber + 1}/${totalChunks}`,
            progress: totalSize > 0 ? Math.round((downloadedBytes / totalSize) * 100) : 0,
            loaded: downloadedBytes,
            total: totalSize,
          })
        }

        // Verify file size
        const stats = await fs.stat(filePath)
        if (stats.size !== totalSize) {
          throw new Error(`File size mismatch: expected ${totalSize}, got ${stats.size}`)
        }

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
