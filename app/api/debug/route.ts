import { NextResponse } from 'next/server'
import * as fs from 'fs/promises'
import * as path from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)
const MODELS_DIR = process.env.MODELS_DIR || '/app/models'

export async function GET() {
  try {
    const debugInfo: any = {
      MODELS_DIR_env: process.env.MODELS_DIR,
      MODELS_DIR_used: MODELS_DIR,
      timestamp: new Date().toISOString(),
    }

    // Check if directory exists
    try {
      const stats = await fs.stat(MODELS_DIR)
      debugInfo.directoryExists = true
      debugInfo.directoryStats = {
        isDirectory: stats.isDirectory(),
        mode: stats.mode.toString(8),
        uid: stats.uid,
        gid: stats.gid,
      }
    } catch (error: any) {
      debugInfo.directoryExists = false
      debugInfo.directoryError = error.message
    }

    // List directory contents
    try {
      const files = await fs.readdir(MODELS_DIR)
      debugInfo.files = files
      debugInfo.fileCount = files.length

      // Get details for each file
      const fileDetails = await Promise.all(
        files.map(async (filename) => {
          try {
            const filePath = path.join(MODELS_DIR, filename)
            const stats = await fs.stat(filePath)
            return {
              filename,
              size: stats.size,
              isFile: stats.isFile(),
              isDirectory: stats.isDirectory(),
              modified: stats.mtime.toISOString(),
            }
          } catch (error: any) {
            return {
              filename,
              error: error.message,
            }
          }
        })
      )
      debugInfo.fileDetails = fileDetails
    } catch (error: any) {
      debugInfo.readdirError = error.message
    }

    // Check current working directory
    try {
      const { stdout: pwd } = await execAsync('pwd')
      debugInfo.currentWorkingDirectory = pwd.trim()
    } catch (error: any) {
      debugInfo.pwdError = error.message
    }

    // Check if wget is available
    try {
      const { stdout: wgetVersion } = await execAsync('wget --version')
      debugInfo.wgetAvailable = true
      debugInfo.wgetVersion = wgetVersion.split('\n')[0]
    } catch (error: any) {
      debugInfo.wgetAvailable = false
      debugInfo.wgetError = error.message
    }

    // Check mount point
    try {
      const { stdout: mountInfo } = await execAsync('mount | grep /app/models')
      debugInfo.mountInfo = mountInfo.trim()
    } catch (error: any) {
      debugInfo.mountInfo = 'Not found or not mounted'
    }

    return NextResponse.json(debugInfo, { status: 200 })
  } catch (error: any) {
    return NextResponse.json(
      {
        error: 'Debug endpoint failed',
        details: error.message,
      },
      { status: 500 }
    )
  }
}

