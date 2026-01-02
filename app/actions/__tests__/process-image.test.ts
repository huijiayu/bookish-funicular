import { describe, it, expect, vi, beforeEach } from 'vitest'
import { processClothingItems } from '../process-image'
import { createServiceClient } from '@/lib/supabase/server'
import { generatePerceptualHash } from '@/lib/utils/perceptual-hash'
import { generateImageEmbedding } from '@/lib/openai/embeddings'
import { analyzeClothingImage } from '@/lib/openai/vision'
import {
  TEST_USER_ID,
  TEST_IMAGE_URL,
  createMockClothingItem,
  createMockClothingMetadata,
} from '../../../test-utils'

vi.mock('@/lib/supabase/server')
vi.mock('@/lib/utils/perceptual-hash')
vi.mock('@/lib/openai/embeddings')
vi.mock('@/lib/openai/vision')

describe('processClothingItems', () => {
  let mockSupabase: any
  let mockQueryBuilder: any

  beforeEach(() => {
    vi.clearAllMocks()

    mockQueryBuilder = {
      select: vi.fn(function(this: any) { return this; }),
      insert: vi.fn(function(this: any) { return this; }),
      update: vi.fn(function(this: any) { return this; }),
      eq: vi.fn(function(this: any) { return this; }),
      not: vi.fn(function(this: any) { return this; }),
      limit: vi.fn(function(this: any) { return this; }),
      single: vi.fn(function(this: any) { return this; }),
      then: vi.fn(function(this: any, onResolve: any) {
        return Promise.resolve(this._mockResult || { data: null, error: null }).then(onResolve)
      }),
      catch: vi.fn(function(this: any, onReject: any) {
        return Promise.resolve(this._mockResult || { data: null, error: null }).catch(onReject)
      }),
      _mockResult: { data: null, error: null },
    }

    mockSupabase = {
      from: vi.fn(() => mockQueryBuilder),
    }

    ;(createServiceClient as any).mockReturnValue(mockSupabase)
  })

  it('creates new items when no duplicates exist', async () => {
    const items = [
      {
        imageUrl: TEST_IMAGE_URL,
        description: 'A navy blue t-shirt',
      },
    ]

    const mockHash = '1010101010101010'
    const mockEmbedding = [0.1, 0.2, 0.3]
    const mockMetadata = createMockClothingMetadata()
    const newItem = createMockClothingItem({ id: 'new-item-1' })

    let callCount = 0
    vi.mocked(generatePerceptualHash).mockResolvedValue(mockHash)
    vi.mocked(generateImageEmbedding).mockResolvedValue(mockEmbedding)
    vi.mocked(analyzeClothingImage).mockResolvedValue(mockMetadata)
    
    // First call: check for exact match (returns null)
    // Second call: check for similar items (limit query, returns [])
    // Third call: insert new item (returns newItem)
    mockQueryBuilder.then = vi.fn(function(this: any, onResolve: any) {
      callCount++
      let result
      if (callCount === 1) {
        result = { data: null, error: null } // No exact match
      } else if (callCount === 2) {
        result = { data: [], error: null } // No similar items
      } else {
        result = { data: newItem, error: null } // Insert result
      }
      return Promise.resolve(result).then(onResolve)
    })

    const result = await processClothingItems(TEST_USER_ID, items)

    expect(result).toHaveLength(1)
    expect(result[0].merged).toBe(false)
    expect(result[0].id).toBe('new-item-1')
    expect(mockQueryBuilder.insert).toHaveBeenCalled()
  })

  it('merges items when exact perceptual hash match found', async () => {
    const items = [
      {
        imageUrl: TEST_IMAGE_URL,
        description: 'A navy blue t-shirt',
      },
    ]

    const mockHash = '1010101010101010'
    const existingItem = createMockClothingItem({ id: 'existing-item-1' })
    const updatedItem = createMockClothingItem({
      id: 'existing-item-1',
      image_urls: {
        primary: existingItem.image_urls.primary,
        variants: [TEST_IMAGE_URL],
      },
    })
    const mockMetadata = createMockClothingMetadata()

    vi.mocked(generatePerceptualHash).mockResolvedValue(mockHash)
    mockQueryBuilder.single.mockResolvedValue({ data: existingItem, error: null })
    vi.mocked(analyzeClothingImage).mockResolvedValue(mockMetadata)
    mockQueryBuilder.single.mockResolvedValue({ data: updatedItem, error: null })

    const result = await processClothingItems(TEST_USER_ID, items)

    expect(result).toHaveLength(1)
    expect(result[0].merged).toBe(true)
    expect(result[0].existingItemId).toBe('existing-item-1')
    expect(result[0].imageAdded).toBe(true)
    expect(mockQueryBuilder.update).toHaveBeenCalled()
  })

  it('handles errors gracefully and continues processing other items', async () => {
    const items = [
      {
        imageUrl: TEST_IMAGE_URL,
        description: 'Item 1',
      },
      {
        imageUrl: TEST_IMAGE_URL,
        description: 'Item 2',
      },
    ]

    const mockHash = '1010101010101010'
    const mockEmbedding = [0.1, 0.2, 0.3]
    const mockMetadata = createMockClothingMetadata()
    const newItem = createMockClothingItem({ id: 'new-item-1' })

    let callCount = 0
    // First item fails, second succeeds
    vi.mocked(generatePerceptualHash)
      .mockResolvedValueOnce(mockHash)
      .mockResolvedValueOnce(mockHash)
    vi.mocked(generateImageEmbedding)
      .mockRejectedValueOnce(new Error('Embedding error'))
      .mockResolvedValueOnce(mockEmbedding)
    vi.mocked(analyzeClothingImage)
      .mockResolvedValueOnce(mockMetadata)
      .mockResolvedValueOnce(mockMetadata)
    
    // Query sequence: 
    // First item: exact match (null) - then embedding fails, so no more queries
    // Second item: exact match (null), similar ([]), insert (newItem)
    mockQueryBuilder.then = vi.fn(function(this: any, onResolve: any) {
      callCount++
      let result
      if (callCount === 1) {
        // First item exact match
        result = { data: null, error: null }
      } else if (callCount === 2) {
        // Second item exact match
        result = { data: null, error: null }
      } else if (callCount === 3) {
        // Second item similar check
        result = { data: [], error: null }
      } else {
        // Second item insert - succeeds
        result = { data: newItem, error: null }
      }
      return Promise.resolve(result).then(onResolve)
    })

    const result = await processClothingItems(TEST_USER_ID, items)

    expect(result).toHaveLength(2)
    // First item should have empty id due to error
    expect(result[0].id).toBe('')
    // Second item should succeed
    expect(result[1].id).toBe('new-item-1')
  })

  it('calls mergeItem correctly with proper metadata merging', async () => {
    const items = [
      {
        imageUrl: TEST_IMAGE_URL,
        description: 'A navy blue t-shirt',
      },
    ]

    const mockHash = '1010101010101010'
    const existingItem = createMockClothingItem({
      id: 'existing-item-1',
      ai_metadata: {
        category: 'top',
        sub_category: 't-shirt',
        primary_color: 'navy blue',
        secondary_colors: ['white'],
        vibe_tags: ['casual'],
        estimated_season: 'all-season',
      },
    })
    const newMetadata = createMockClothingMetadata({
      vibe_tags: ['casual', 'minimalist'],
      secondary_colors: ['white', 'red'],
    })
    const updatedItem = createMockClothingItem({
      id: 'existing-item-1',
      image_urls: {
        primary: existingItem.image_urls.primary,
        variants: [TEST_IMAGE_URL],
      },
      ai_metadata: {
        ...existingItem.ai_metadata,
        vibe_tags: ['casual', 'minimalist'],
        secondary_colors: ['white', 'red'],
      },
    })

    vi.mocked(generatePerceptualHash).mockResolvedValue(mockHash)
    mockQueryBuilder.single.mockResolvedValue({ data: existingItem, error: null })
    vi.mocked(analyzeClothingImage).mockResolvedValue(newMetadata)
    mockQueryBuilder.single.mockResolvedValue({ data: updatedItem, error: null })

    const result = await processClothingItems(TEST_USER_ID, items)

    expect(result[0].merged).toBe(true)
    // Verify metadata merging - vibe_tags should be deduplicated
    const updateCall = mockQueryBuilder.update.mock.calls[0][0]
    expect(updateCall.ai_metadata.vibe_tags).toContain('casual')
    expect(updateCall.ai_metadata.vibe_tags).toContain('minimalist')
    // Should not have duplicate 'casual'
    expect(updateCall.ai_metadata.vibe_tags.filter((t: string) => t === 'casual').length).toBe(1)
  })

  it('preserves existing metadata when new is empty', async () => {
    const items = [
      {
        imageUrl: TEST_IMAGE_URL,
      },
    ]

    const mockHash = '1010101010101010'
    const existingItem = createMockClothingItem({
      id: 'existing-item-1',
      ai_metadata: {
        category: 'top',
        sub_category: 't-shirt',
        primary_color: 'navy blue',
        secondary_colors: ['white'],
        vibe_tags: ['casual'],
        estimated_season: 'all-season',
      },
    })
    const newMetadata = createMockClothingMetadata({
      category: '',
      sub_category: '',
      primary_color: '',
    })
    const updatedItem = createMockClothingItem({
      id: 'existing-item-1',
      ai_metadata: existingItem.ai_metadata,
    })

    vi.mocked(generatePerceptualHash).mockResolvedValue(mockHash)
    mockQueryBuilder.single.mockResolvedValue({ data: existingItem, error: null })
    vi.mocked(analyzeClothingImage).mockResolvedValue(newMetadata)
    mockQueryBuilder.single.mockResolvedValue({ data: updatedItem, error: null })

    await processClothingItems(TEST_USER_ID, items)

    const updateCall = mockQueryBuilder.update.mock.calls[0][0]
    // Should preserve existing values when new ones are empty
    expect(updateCall.ai_metadata.category).toBe('top')
    expect(updateCall.ai_metadata.sub_category).toBe('t-shirt')
    expect(updateCall.ai_metadata.primary_color).toBe('navy blue')
  })

  it('handles missing existing item error', async () => {
    const items = [
      {
        imageUrl: TEST_IMAGE_URL,
      },
    ]

    const mockHash = '1010101010101010'
    const existingItem = createMockClothingItem({ id: 'existing-item-1' })

    vi.mocked(generatePerceptualHash).mockResolvedValue(mockHash)
    // First call finds existing item
    mockQueryBuilder.single.mockResolvedValueOnce({ data: existingItem, error: null })
    // Second call (fetching for merge) fails
    mockQueryBuilder.single.mockResolvedValueOnce({ data: null, error: { message: 'Not found' } })

    const result = await processClothingItems(TEST_USER_ID, items)

    // Should handle error gracefully
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('')
  })
})

