import { NextResponse } from 'next/server'
import * as fs from 'fs/promises'
import * as path from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)
const MODELS_DIR = process.env.MODELS_DIR || '/app/models'

export async function GET() {
  try {
    const testResults: any = {
      timestamp: new Date().toISOString(),
      MODELS_DIR: MODELS_DIR,
      MODELS_DIR_env: process.env.MODELS_DIR,
    }

    // Test 1: Check if directory exists
    try {
      const stats = await fs.stat(MODELS_DIR)
      testResults.directoryExists = true
      testResults.directoryStats = {
        isDirectory: stats.isDirectory(),
        mode: stats.mode.toString(8),
        uid: stats.uid,
        gid: stats.gid,
      }
    } catch (error: any) {
      testResults.directoryExists = false
      testResults.directoryError = error.message
    }

    // Test 2: Try to create directory
    try {
      await fs.mkdir(MODELS_DIR, { recursive: true })
      testResults.directoryCreated = true
    } catch (error: any) {
      testResults.directoryCreated = false
      testResults.directoryCreateError = error.message
    }

    // Test 3: Try to write a test file
    const testFileName = `test-${Date.now()}.txt`
    const testFilePath = path.join(MODELS_DIR, testFileName)
    try {
      await fs.writeFile(testFilePath, `Test file created at ${new Date().toISOString()}\nMODELS_DIR: ${MODELS_DIR}`)
      testResults.writeTest = { success: true, filePath: testFilePath }
      
      // Verify we can read it back
      const content = await fs.readFile(testFilePath, 'utf-8')
      testResults.readTest = { success: true, content: content.substring(0, 100) }
      
      // Get file stats
      const fileStats = await fs.stat(testFilePath)
      testResults.fileStats = {
        size: fileStats.size,
        mode: fileStats.mode.toString(8),
        uid: fileStats.uid,
        gid: fileStats.gid,
      }
      
      // Clean up test file
      await fs.unlink(testFilePath)
      testResults.cleanup = { success: true }
    } catch (error: any) {
      testResults.writeTest = { success: false, error: error.message }
    }

    // Test 4: List directory contents
    try {
      const files = await fs.readdir(MODELS_DIR)
      testResults.directoryContents = files
      testResults.fileCount = files.length
    } catch (error: any) {
      testResults.directoryContentsError = error.message
    }

    // Test 5: Check mount point
    try {
      const { stdout: mountInfo } = await execAsync(`mount | grep "${MODELS_DIR}" || mount | grep "/app/models"`)
      testResults.mountInfo = mountInfo.trim()
    } catch (error: any) {
      testResults.mountInfo = 'Not found'
    }

    // Test 6: Check current user
    try {
      const { stdout: whoami } = await execAsync('whoami')
      const { stdout: id } = await execAsync('id')
      testResults.currentUser = {
        whoami: whoami.trim(),
        id: id.trim(),
      }
    } catch (error: any) {
      testResults.currentUserError = error.message
    }

    // Test 7: Check permissions on directory
    try {
      const { stdout: ls } = await execAsync(`ls -ld "${MODELS_DIR}"`)
      testResults.directoryPermissions = ls.trim()
    } catch (error: any) {
      testResults.directoryPermissionsError = error.message
    }

    return NextResponse.json(testResults, { status: 200 })
  } catch (error: any) {
    return NextResponse.json(
      {
        error: 'Test endpoint failed',
        details: error.message,
        stack: error.stack,
      },
      { status: 500 }
    )
  }
}

