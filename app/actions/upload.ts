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
  // Validate inputs
  if (!userId || typeof userId !== 'string' || userId.trim() === '') {
    throw new Error('Invalid userId: userId is required and must be a non-empty string')
  }

  if (!fileName || typeof fileName !== 'string' || fileName.trim() === '') {
    throw new Error('Invalid fileName: fileName is required and must be a non-empty string')
  }

  try {
    const supabase = createServiceClient()
    
    // Handle file extension - default to 'bin' if no extension found
    const fileExt = fileName.includes('.') 
      ? fileName.split('.').pop()?.toLowerCase() || 'bin'
      : 'bin'
    
    // Sanitize file extension to prevent path traversal
    const sanitizedExt = fileExt.replace(/[^a-z0-9]/gi, '') || 'bin'
    
    const filePath = `${userId}/uploads/${Date.now()}-${Math.random().toString(36).substring(7)}.${sanitizedExt}`

    const { data, error } = await supabase.storage
      .from('clothing-items')
      .createSignedUploadUrl(filePath, {
        upsert: false,
      })

    if (error) {
      // Check for common error cases and provide helpful messages
      if (error.message?.includes('does not exist') || error.message?.includes('not found')) {
        throw new Error(
          'Storage bucket "clothing-items" does not exist. Please run the database migration (003_setup_storage.sql) to create the storage bucket.'
        )
      }
      throw new Error(`Failed to create signed URL: ${error.message}`)
    }

    if (!data || !data.signedUrl) {
      throw new Error('Invalid response from Supabase: signedUrl is missing')
    }

    return {
      signedUrl: data.signedUrl,
      path: filePath,
    }
  } catch (error) {
    console.error('Error creating signed upload URL:', error)
    // Preserve the original error message if it's already an Error
    if (error instanceof Error) {
      throw error
    }
    throw new Error('Failed to create upload URL: Unknown error occurred')
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

