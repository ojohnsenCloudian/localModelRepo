import { NextRequest, NextResponse } from 'next/server'
import { setModelTags, getModelTags } from '../metadata'

export async function PUT(request: NextRequest) {
  try {
    const { filename, tags } = await request.json()

    if (!filename || typeof filename !== 'string') {
      return NextResponse.json(
        { error: 'Filename is required' },
        { status: 400 }
      )
    }

    if (!Array.isArray(tags)) {
      return NextResponse.json(
        { error: 'Tags must be an array' },
        { status: 400 }
      )
    }

    // Validate tags are strings
    const validTags = tags.filter((tag: any) => typeof tag === 'string' && tag.trim().length > 0)
      .map((tag: string) => tag.trim().toLowerCase())
      .filter((tag: string, index: number, arr: string[]) => arr.indexOf(tag) === index) // Remove duplicates

    await setModelTags(filename, validTags)

    return NextResponse.json({
      success: true,
      tags: validTags,
    })
  } catch (error: any) {
    console.error('Error updating tags:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update tags' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const filename = searchParams.get('filename')

    if (!filename) {
      return NextResponse.json(
        { error: 'Filename is required' },
        { status: 400 }
      )
    }

    const tags = await getModelTags(filename)

    return NextResponse.json({ tags })
  } catch (error: any) {
    console.error('Error fetching tags:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch tags' },
      { status: 500 }
    )
  }
}

