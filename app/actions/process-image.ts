'use server'

import { createServiceClient } from '@/lib/supabase/server'
import { generatePerceptualHash } from '@/lib/utils/perceptual-hash'
import { analyzeClothingImage, type ClothingMetadata } from '@/lib/gemini/vision'
import type { DetectedItem } from '@/lib/gemini/multi-item-detection'

export interface ProcessedItem {
  id: string
  merged: boolean
  existingItemId?: string
  imageAdded?: boolean
}

export interface ProcessItemInput {
  imageUrl: string
  description?: string
  category?: string
  boundingBox?: {
    x: number
    y: number
    width: number
    height: number
  }
}

/**
 * Processes confirmed clothing items: deduplication + metadata extraction
 */
export async function processClothingItems(
  userId: string,
  items: ProcessItemInput[]
): Promise<ProcessedItem[]> {
  const supabase = createServiceClient()
  const results: ProcessedItem[] = []

  for (const item of items) {
    try {
      // Step 1: Generate perceptual hash based on bounding box if provided
      // This ensures items from the same image have different hashes
      const perceptualHash = await generatePerceptualHash(
        item.imageUrl,
        item.boundingBox
      )

      // Step 2: Check for exact duplicate (perceptual hash match)
      const { data: exactMatch } = await supabase
        .from('clothing_items')
        .select('*')
        .eq('user_id', userId)
        .eq('perceptual_hash', perceptualHash)
        .single()

      if (exactMatch) {
        // Exact duplicate found - merge
        const merged = await mergeItem(
          supabase,
          exactMatch.id,
          item.imageUrl,
          userId
        )
        results.push({
          id: merged.id,
          merged: true,
          existingItemId: exactMatch.id,
          imageAdded: true,
        })
        continue
      }

      // Step 3: Check for similar items using cosine similarity
      // TODO: Implement vision embeddings with Gemini for semantic similarity
      // For now, we skip this check and rely only on exact perceptual hash matches.
      // TODO: Implement pgvector cosine similarity check for semantic duplicate detection
      // This requires:
      // 1. Storing vision_embedding in the database (currently generated but not stored)
      // 2. Using pgvector's cosine similarity operator: SELECT *, 1 - (vision_embedding <=> $1::vector) as similarity
      // 3. Filtering results by similarity threshold (e.g., similarity > 0.85)
      // 4. If similar item found, merge with existing item (add image to variants)
      // 
      // Example query:
      // SELECT *, 1 - (vision_embedding <=> $1::vector) as similarity
      // FROM clothing_items
      // WHERE user_id = $2
      //   AND vision_embedding IS NOT NULL
      //   AND 1 - (vision_embedding <=> $1::vector) > 0.85
      // ORDER BY vision_embedding <=> $1::vector
      // LIMIT 1
      //
      // For now, we skip this check and rely only on exact perceptual hash matches.
      const { data: similarItems } = await supabase
        .from('clothing_items')
        .select('*')
        .eq('user_id', userId)
        .not('vision_embedding', 'is', null)
        .limit(50) // Get candidates for similarity check (not currently used)

      // Step 5: If no duplicate found, create new item
      const metadata = await analyzeClothingImage(
        item.imageUrl,
        item.description
      )

      const imageUrls = {
        primary: item.imageUrl,
        variants: [],
      }

      const { data: newItem, error } = await supabase
        .from('clothing_items')
        .insert({
          user_id: userId,
          image_urls: imageUrls,
          perceptual_hash: perceptualHash,
          ai_metadata: metadata,
          // Note: vision_embedding would be set here if pgvector is properly configured
          // For now, we'll store it as JSONB or skip it
        })
        .select()
        .single()

      if (error) {
        console.error('Error creating clothing item:', error)
        const errorDetails = error.message || 'Unknown database error'
        throw new Error(`Failed to create clothing item: ${errorDetails}`)
      }

      results.push({
        id: newItem.id,
        merged: false,
      })
    } catch (error) {
      console.error('Error processing item:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error(`Failed to process item "${item.description}": ${errorMessage}`)
      // Continue with next item even if one fails
      results.push({
        id: '',
        merged: false,
      })
    }
  }

  return results
}

/**
 * Merges a new image with an existing clothing item
 */
async function mergeItem(
  supabase: any,
  existingItemId: string,
  newImageUrl: string,
  userId: string
) {
  // Get existing item
  const { data: existingItem, error: fetchError } = await supabase
    .from('clothing_items')
    .select('*')
    .eq('id', existingItemId)
    .eq('user_id', userId)
    .single()

  if (fetchError || !existingItem) {
    throw new Error('Existing item not found')
  }

  // Update image_urls to add new image to variants
  const imageUrls = existingItem.image_urls || { primary: '', variants: [] }
  if (!imageUrls.variants) {
    imageUrls.variants = []
  }
  imageUrls.variants.push(newImageUrl)

  // Merge metadata
  const existingMetadata = existingItem.ai_metadata || {}
  const newMetadata = await analyzeClothingImage(newImageUrl)
  
  // Combine vibe_tags (deduplicate)
  const combinedVibeTags = [
    ...(existingMetadata.vibe_tags || []),
    ...(newMetadata.vibe_tags || []),
  ]
  const uniqueVibeTags = Array.from(new Set(combinedVibeTags))

  const mergedMetadata = {
    ...existingMetadata,
    ...newMetadata,
    vibe_tags: uniqueVibeTags,
    // Keep existing values if new ones are empty/less complete
    category: newMetadata.category || existingMetadata.category,
    sub_category: newMetadata.sub_category || existingMetadata.sub_category,
    primary_color: newMetadata.primary_color || existingMetadata.primary_color,
    secondary_colors: [
      ...(existingMetadata.secondary_colors || []),
      ...(newMetadata.secondary_colors || []),
    ].filter((v, i, a) => a.indexOf(v) === i), // Deduplicate
  }

  // Update existing item
  const { data: updatedItem, error: updateError } = await supabase
    .from('clothing_items')
    .update({
      image_urls: imageUrls,
      ai_metadata: mergedMetadata,
      updated_at: new Date().toISOString(),
    })
    .eq('id', existingItemId)
    .select()
    .single()

  if (updateError) {
    throw new Error('Failed to merge item')
  }

  return updatedItem
}

