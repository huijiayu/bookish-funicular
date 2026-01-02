'use server'

import { createServiceClient } from '@/lib/supabase/server'
import { detectClothingItems, type DetectedItem } from '@/lib/openai/multi-item-detection'

export interface SignedUploadUrlResponse {
  signedUrl: string
  path: string
}

/**
 * Creates a signed upload URL for direct client-side upload to Supabase Storage
 */
export async function createSignedUploadUrl(
  userId: string,
  fileName: string
): Promise<SignedUploadUrlResponse> {
  try {
    const supabase = createServiceClient()
    const fileExt = fileName.split('.').pop()
    const filePath = `${userId}/uploads/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`

    const { data, error } = await supabase.storage
      .from('clothing-items')
      .createSignedUploadUrl(filePath, {
        upsert: false,
      })

    if (error) {
      throw new Error(`Failed to create signed URL: ${error.message}`)
    }

    return {
      signedUrl: data.signedUrl,
      path: filePath,
    }
  } catch (error) {
    console.error('Error creating signed upload URL:', error)
    throw new Error('Failed to create upload URL')
  }
}

/**
 * Detects multiple clothing items in an uploaded image
 */
export async function detectClothingItemsAction(
  userId: string,
  imageUrl: string
): Promise<DetectedItem[]> {
  try {
    const items = await detectClothingItems(imageUrl)
    return items
  } catch (error) {
    console.error('Error detecting clothing items:', error)
    throw new Error('Failed to detect clothing items')
  }
}

