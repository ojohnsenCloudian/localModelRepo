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

    // Log the models directory being used
    console.log(`MODELS_DIR environment variable: ${process.env.MODELS_DIR}`)
    console.log(`Using MODELS_DIR: ${MODELS_DIR}`)

    // Extract filename from URL, removing query parameters
    const urlObj = new URL(url)
    const urlPathParts = urlObj.pathname.split('/')
    let filename = urlPathParts[urlPathParts.length - 1] || `model-${Date.now()}`
    
    // If filename is empty or just a path, use a default name
    if (!filename || filename === '' || !filename.includes('.')) {
      // Try to get a better filename from the URL
      const pathParts = urlObj.pathname.split('/').filter(p => p)
      if (pathParts.length > 0) {
        filename = pathParts[pathParts.length - 1] || `model-${Date.now()}.bin`
      } else {
        filename = `model-${Date.now()}.bin`
      }
    }
    
    // Clean filename - remove any problematic characters
    filename = filename.replace(/[^a-zA-Z0-9._-]/g, '_')
    
    // Use absolute path
    const filePath = path.resolve(MODELS_DIR, filename)

    console.log(`Downloading from ${url}`)
    console.log(`Extracted filename: ${filename}`)
    console.log(`Target file path: ${filePath}`)

    // Use wget to download the file
    // -O specifies output file (use absolute path)
    // --progress=dot shows progress
    // --no-check-certificate in case of SSL issues
    // Use absolute path directly
    const wgetCommand = `wget -O "${filePath}" "${url}" --progress=dot --no-check-certificate`

    console.log(`Executing command: ${wgetCommand}`)

    // Execute wget from the models directory
    const { stdout, stderr } = await execAsync(wgetCommand, {
      maxBuffer: 1024 * 1024 * 100, // 100MB buffer
      cwd: MODELS_DIR,
    })

    console.log(`wget stdout: ${stdout}`)
    if (stderr) {
      console.log(`wget stderr: ${stderr}`)
    }

    // Immediately check what files exist in the directory
    try {
      const filesBeforeCheck = await fs.readdir(MODELS_DIR)
      console.log(`Files in directory immediately after wget: ${filesBeforeCheck.join(', ')}`)
    } catch (err) {
      console.error(`Error listing directory: ${err}`)
    }

    // Wait a moment for file system to sync
    await new Promise(resolve => setTimeout(resolve, 1000))

    // Check if file was downloaded successfully
    try {
      // Use absolute path to check file
      const absolutePath = path.resolve(MODELS_DIR, filename)
      const stats = await fs.stat(absolutePath)
      console.log(`File successfully downloaded: ${absolutePath}, size: ${stats.size} bytes`)
      
      // Also verify the directory contents
      const dirContents = await fs.readdir(MODELS_DIR)
      console.log(`Directory contents after download: ${dirContents.join(', ')}`)
      
      return NextResponse.json({
        success: true,
        filename,
        size: stats.size,
        filePath: absolutePath,
        message: 'Download completed successfully',
      })
    } catch (error: any) {
      console.error(`File not found at ${filePath}:`, error.message)
      
      // Try to list directory contents to see what's there
      try {
        const dirContents = await fs.readdir(MODELS_DIR)
        console.log(`Directory contents: ${dirContents.join(', ')}`)
        
        // Check if file exists with a different name
        const matchingFiles = dirContents.filter(f => f.includes(filename.split('.')[0]))
        if (matchingFiles.length > 0) {
          console.log(`Found similar files: ${matchingFiles.join(', ')}`)
        }
      } catch (dirError) {
        console.error(`Cannot read directory ${MODELS_DIR}:`, dirError)
      }
      
      return NextResponse.json(
        {
          error: 'Download failed - file not found',
          details: stderr || stdout || error.message,
          filePath: filePath,
          filename: filename,
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

