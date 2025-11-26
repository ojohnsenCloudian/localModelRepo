import fs from 'fs/promises'
import path from 'path'

const METADATA_FILE = '/app/models/.metadata.json'

export interface ModelMetadata {
  tags: string[]
}

export interface ModelsMetadata {
  [filename: string]: ModelMetadata
}

export async function getMetadata(): Promise<ModelsMetadata> {
  try {
    const data = await fs.readFile(METADATA_FILE, 'utf-8')
    return JSON.parse(data)
  } catch {
    return {}
  }
}

export async function saveMetadata(metadata: ModelsMetadata): Promise<void> {
  await fs.writeFile(METADATA_FILE, JSON.stringify(metadata, null, 2), 'utf-8')
}

export async function getModelTags(filename: string): Promise<string[]> {
  const metadata = await getMetadata()
  return metadata[filename]?.tags || []
}

export async function setModelTags(filename: string, tags: string[]): Promise<void> {
  const metadata = await getMetadata()
  metadata[filename] = { tags }
  await saveMetadata(metadata)
}

