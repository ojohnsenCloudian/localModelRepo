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

    // Ensure we're using absolute path and directory exists
    await fs.mkdir(MODELS_DIR, { recursive: true })
    
    // Use wget to download the file
    // -O specifies output file (use absolute path)
    // --progress=dot shows progress
    // --no-check-certificate in case of SSL issues
    // Use absolute path directly - don't use cwd to avoid issues
    const wgetCommand = `wget -O "${filePath}" "${url}" --progress=dot --no-check-certificate 2>&1`

    console.log(`Executing command: ${wgetCommand}`)
    console.log(`Working directory will be: ${process.cwd()}`)

    // Execute wget - use absolute path, don't rely on cwd
    let stdout = ''
    let stderr = ''
    try {
      const result = await execAsync(wgetCommand, {
        maxBuffer: 1024 * 1024 * 1024 * 10, // 10GB buffer for large files
        timeout: 3600000, // 1 hour timeout
      })
      stdout = result.stdout || ''
      stderr = result.stderr || ''
    } catch (error: any) {
      // wget might output to stderr even on success, so check if file exists
      stdout = error.stdout || ''
      stderr = error.stderr || error.message || ''
      console.log(`wget command completed (may have warnings): ${stderr}`)
    }

    console.log(`wget output: ${stdout}`)
    if (stderr && !stderr.includes('saved')) {
      console.log(`wget stderr: ${stderr}`)
    }

    // Wait for file system to sync
    await new Promise(resolve => setTimeout(resolve, 2000))

    // Check if file was downloaded successfully
    const absolutePath = path.resolve(MODELS_DIR, filename)
    console.log(`Checking for file at: ${absolutePath}`)
    
    try {
      const stats = await fs.stat(absolutePath)
      
      if (stats.isFile() && stats.size > 0) {
        console.log(`✓ File successfully downloaded: ${absolutePath}, size: ${stats.size} bytes`)
        
        // Verify the directory contents
        const dirContents = await fs.readdir(MODELS_DIR)
        console.log(`Directory now contains: ${dirContents.join(', ')}`)
        
        return NextResponse.json({
          success: true,
          filename,
          size: stats.size,
          filePath: absolutePath,
          message: 'Download completed successfully',
        })
      } else {
        throw new Error('File exists but is not a valid file or is empty')
      }
    } catch (error: any) {
      console.error(`✗ File not found at ${absolutePath}:`, error.message)
      
      // List all files in directory to see what's actually there
      try {
        const dirContents = await fs.readdir(MODELS_DIR)
        console.log(`Current directory contents: ${dirContents.join(', ')}`)
        console.log(`Looking for: ${filename}`)
        
        // Check if file exists with a different name or extension
        const allFiles = dirContents.filter(f => {
          const baseName = f.split('.')[0]
          const targetBaseName = filename.split('.')[0]
          return baseName === targetBaseName || f.includes(targetBaseName) || targetBaseName.includes(baseName)
        })
        
        if (allFiles.length > 0) {
          console.log(`Found similar files: ${allFiles.join(', ')}`)
          // Try to use the first matching file
          const foundFile = allFiles[0]
          const foundPath = path.resolve(MODELS_DIR, foundFile)
          const foundStats = await fs.stat(foundPath)
          
          return NextResponse.json({
            success: true,
            filename: foundFile,
            size: foundStats.size,
            filePath: foundPath,
            message: `Download completed (saved as ${foundFile})`,
            originalFilename: filename,
          })
        }
      } catch (dirError: any) {
        console.error(`Cannot read directory ${MODELS_DIR}:`, dirError.message)
      }
      
      // Check if wget actually succeeded by looking at output
      const wgetSuccess = stdout.includes('saved') || stdout.includes('100%') || stderr.includes('saved')
      
      return NextResponse.json(
        {
          error: 'Download failed - file not found at expected location',
          details: wgetSuccess ? 'File may have been saved with a different name' : (stderr || stdout || error.message),
          filePath: absolutePath,
          filename: filename,
          wgetOutput: stdout + stderr,
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

