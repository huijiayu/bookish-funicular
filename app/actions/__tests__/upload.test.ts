import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  createSignedUploadUrl,
  detectClothingItemsAction,
} from '../upload'
import { createServiceClient } from '@/lib/supabase/server'
import { detectClothingItems } from '@/lib/openai/multi-item-detection'
import { TEST_USER_ID, createMockDetectedItem } from '../../../test-utils'

vi.mock('@/lib/supabase/server')
vi.mock('@/lib/openai/multi-item-detection')

describe('createSignedUploadUrl', () => {
  let mockSupabase: any
  let mockStorage: any

  beforeEach(() => {
    vi.clearAllMocks()

    mockStorage = {
      from: vi.fn(() => ({
        createSignedUploadUrl: vi.fn(),
      })),
    }

    mockSupabase = {
      storage: mockStorage,
    }

    ;(createServiceClient as any).mockReturnValue(mockSupabase)
  })

  it('creates correct file path with userId and timestamp', async () => {
    const fileName = 'test-image.jpg'
    const mockSignedUrl = 'https://storage.supabase.co/signed-url'
    const mockPath = `${TEST_USER_ID}/uploads/1234567890-abc123.jpg`

    const storageFrom = mockStorage.from('clothing-items')
    storageFrom.createSignedUploadUrl.mockResolvedValue({
      signedUrl: mockSignedUrl,
      path: mockPath,
    })

    const result = await createSignedUploadUrl(TEST_USER_ID, fileName)

    expect(mockStorage.from).toHaveBeenCalledWith('clothing-items')
    const storageFrom = mockStorage.from('clothing-items')
    expect(storageFrom.createSignedUploadUrl).toHaveBeenCalledWith(
      expect.stringMatching(new RegExp(`${TEST_USER_ID}/uploads/\\d+-[a-z0-9]+\\.jpg`)),
      {
        upsert: false,
      }
    )
    expect(result.signedUrl).toBe(mockSignedUrl)
    expect(result.path).toBe(mockPath)
  })

  it('returns signed URL and path', async () => {
    const fileName = 'test-image.png'
    const mockSignedUrl = 'https://storage.supabase.co/signed-url'
    const mockPath = 'user/uploads/file.png'

    const storageFrom = mockStorage.from('clothing-items')
    storageFrom.createSignedUploadUrl.mockResolvedValue({
      signedUrl: mockSignedUrl,
      path: mockPath,
    })

    const result = await createSignedUploadUrl(TEST_USER_ID, fileName)

    expect(result).toHaveProperty('signedUrl')
    expect(result).toHaveProperty('path')
    expect(result.signedUrl).toBe(mockSignedUrl)
    expect(result.path).toBe(mockPath)
  })

  it('handles errors gracefully', async () => {
    const fileName = 'test-image.jpg'

    const storageFrom = mockStorage.from('clothing-items')
    storageFrom.createSignedUploadUrl.mockRejectedValue(new Error('Storage error'))

    await expect(createSignedUploadUrl(TEST_USER_ID, fileName)).rejects.toThrow(
      'Failed to create upload URL'
    )
  })

  it('handles different file extensions', async () => {
    const fileName = 'test-image.jpeg'
    const mockSignedUrl = 'https://storage.supabase.co/signed-url'
    const mockPath = 'user/uploads/file.jpeg'

    const storageFrom = mockStorage.from('clothing-items')
    storageFrom.createSignedUploadUrl.mockResolvedValue({
      signedUrl: mockSignedUrl,
      path: mockPath,
    })

    const result = await createSignedUploadUrl(TEST_USER_ID, fileName)

    expect(result.path).toMatch(/\.jpeg$/)
  })
})

describe('detectClothingItemsAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls detectClothingItems correctly', async () => {
    const imageUrl = 'https://example.com/image.jpg'
    const mockItems = [createMockDetectedItem()]

    vi.mocked(detectClothingItems).mockResolvedValue(mockItems)

    const result = await detectClothingItemsAction(TEST_USER_ID, imageUrl)

    expect(detectClothingItems).toHaveBeenCalledWith(imageUrl)
    expect(result).toEqual(mockItems)
  })

  it('returns detected items', async () => {
    const imageUrl = 'https://example.com/image.jpg'
    const mockItems = [
      createMockDetectedItem({
        description: 'A navy blue t-shirt',
        category: 'top',
        confidence: 0.9,
      }),
      createMockDetectedItem({
        description: 'Blue jeans',
        category: 'bottom',
        confidence: 0.8,
      }),
    ]

    vi.mocked(detectClothingItems).mockResolvedValue(mockItems)

    const result = await detectClothingItemsAction(TEST_USER_ID, imageUrl)

    expect(result).toHaveLength(2)
    expect(result[0].description).toBe('A navy blue t-shirt')
    expect(result[1].description).toBe('Blue jeans')
  })

  it('handles errors gracefully', async () => {
    const imageUrl = 'https://example.com/image.jpg'

    vi.mocked(detectClothingItems).mockRejectedValue(new Error('Detection error'))

    await expect(detectClothingItemsAction(TEST_USER_ID, imageUrl)).rejects.toThrow(
      'Failed to detect clothing items'
    )
  })

  it('handles empty detection results', async () => {
    const imageUrl = 'https://example.com/image.jpg'

    vi.mocked(detectClothingItems).mockResolvedValue([])

    const result = await detectClothingItemsAction(TEST_USER_ID, imageUrl)

    expect(result).toEqual([])
  })
})

