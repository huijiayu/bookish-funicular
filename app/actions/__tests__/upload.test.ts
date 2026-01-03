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

    const storageBucket = {
      createSignedUploadUrl: vi.fn(),
    }

    mockStorage = {
      from: vi.fn(() => storageBucket),
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

    const storageBucket = mockStorage.from('clothing-items')
    storageBucket.createSignedUploadUrl.mockResolvedValue({
      data: {
        signedUrl: mockSignedUrl,
        path: mockPath,
      },
      error: null,
    })

    const result = await createSignedUploadUrl(TEST_USER_ID, fileName)

    expect(mockStorage.from).toHaveBeenCalledWith('clothing-items')
    expect(storageBucket.createSignedUploadUrl).toHaveBeenCalledWith(
      expect.stringMatching(new RegExp(`${TEST_USER_ID}/uploads/\\d+-[a-z0-9]+\\.jpg`)),
      {
        upsert: false,
      }
    )
    expect(result.signedUrl).toBe(mockSignedUrl)
    // The function returns the constructed path, not data.path
    expect(result.path).toMatch(new RegExp(`${TEST_USER_ID}/uploads/\\d+-[a-z0-9]+\\.jpg`))
  })

  it('returns signed URL and path', async () => {
    const fileName = 'test-image.png'
    const mockSignedUrl = 'https://storage.supabase.co/signed-url'
    const mockPath = 'user/uploads/file.png'

    const storageBucket = mockStorage.from('clothing-items')
    storageBucket.createSignedUploadUrl.mockResolvedValue({
      data: {
        signedUrl: mockSignedUrl,
        path: mockPath,
      },
      error: null,
    })

    const result = await createSignedUploadUrl(TEST_USER_ID, fileName)

    expect(result).toHaveProperty('signedUrl')
    expect(result).toHaveProperty('path')
    expect(result.signedUrl).toBe(mockSignedUrl)
    // The function returns the constructed path, not data.path, so we check it matches the pattern
    expect(result.path).toMatch(new RegExp(`${TEST_USER_ID}/uploads/\\d+-[a-z0-9]+\\.png`))
  })

  it('handles storage errors gracefully', async () => {
    const fileName = 'test-image.jpg'

    const storageBucket = mockStorage.from('clothing-items')
    storageBucket.createSignedUploadUrl.mockResolvedValue({
      data: null,
      error: { message: 'Storage error' },
    })

    await expect(createSignedUploadUrl(TEST_USER_ID, fileName)).rejects.toThrow(
      'Failed to create signed URL: Storage error'
    )
  })

  it('provides helpful error message when storage bucket does not exist', async () => {
    const fileName = 'test-image.jpg'

    const storageBucket = mockStorage.from('clothing-items')
    storageBucket.createSignedUploadUrl.mockResolvedValue({
      data: null,
      error: { message: 'The related resource does not exist' },
    })

    await expect(createSignedUploadUrl(TEST_USER_ID, fileName)).rejects.toThrow(
      'Storage bucket "clothing-items" does not exist'
    )
  })

  it('provides helpful error message when storage bucket is not found', async () => {
    const fileName = 'test-image.jpg'

    const storageBucket = mockStorage.from('clothing-items')
    storageBucket.createSignedUploadUrl.mockResolvedValue({
      data: null,
      error: { message: 'Bucket not found' },
    })

    await expect(createSignedUploadUrl(TEST_USER_ID, fileName)).rejects.toThrow(
      'Storage bucket "clothing-items" does not exist'
    )
  })

  it('handles missing signedUrl in response', async () => {
    const fileName = 'test-image.jpg'

    const storageBucket = mockStorage.from('clothing-items')
    storageBucket.createSignedUploadUrl.mockResolvedValue({
      data: { signedUrl: null },
      error: null,
    })

    await expect(createSignedUploadUrl(TEST_USER_ID, fileName)).rejects.toThrow(
      'Invalid response from Supabase: signedUrl is missing'
    )
  })

  it('handles null data in response', async () => {
    const fileName = 'test-image.jpg'

    const storageBucket = mockStorage.from('clothing-items')
    storageBucket.createSignedUploadUrl.mockResolvedValue({
      data: null,
      error: null,
    })

    await expect(createSignedUploadUrl(TEST_USER_ID, fileName)).rejects.toThrow(
      'Invalid response from Supabase: signedUrl is missing'
    )
  })

  it('handles files without extensions', async () => {
    const fileName = 'test-image'
    const mockSignedUrl = 'https://storage.supabase.co/signed-url'

    const storageBucket = mockStorage.from('clothing-items')
    storageBucket.createSignedUploadUrl.mockResolvedValue({
      data: {
        signedUrl: mockSignedUrl,
        path: 'test-path',
      },
      error: null,
    })

    const result = await createSignedUploadUrl(TEST_USER_ID, fileName)

    expect(result.path).toMatch(/\.bin$/)
    expect(result.signedUrl).toBe(mockSignedUrl)
  })

  it('handles files with uppercase extensions', async () => {
    const fileName = 'test-image.JPG'
    const mockSignedUrl = 'https://storage.supabase.co/signed-url'

    const storageBucket = mockStorage.from('clothing-items')
    storageBucket.createSignedUploadUrl.mockResolvedValue({
      data: {
        signedUrl: mockSignedUrl,
        path: 'test-path',
      },
      error: null,
    })

    const result = await createSignedUploadUrl(TEST_USER_ID, fileName)

    expect(result.path).toMatch(/\.jpg$/)
    expect(result.signedUrl).toBe(mockSignedUrl)
  })

  it('rejects empty userId', async () => {
    const fileName = 'test-image.jpg'

    await expect(createSignedUploadUrl('', fileName)).rejects.toThrow(
      'Invalid userId: userId is required and must be a non-empty string'
    )
  })

  it('rejects null userId', async () => {
    const fileName = 'test-image.jpg'

    await expect(createSignedUploadUrl(null as any, fileName)).rejects.toThrow(
      'Invalid userId: userId is required and must be a non-empty string'
    )
  })

  it('rejects undefined userId', async () => {
    const fileName = 'test-image.jpg'

    await expect(createSignedUploadUrl(undefined as any, fileName)).rejects.toThrow(
      'Invalid userId: userId is required and must be a non-empty string'
    )
  })

  it('rejects whitespace-only userId', async () => {
    const fileName = 'test-image.jpg'

    await expect(createSignedUploadUrl('   ', fileName)).rejects.toThrow(
      'Invalid userId: userId is required and must be a non-empty string'
    )
  })

  it('rejects empty fileName', async () => {
    await expect(createSignedUploadUrl(TEST_USER_ID, '')).rejects.toThrow(
      'Invalid fileName: fileName is required and must be a non-empty string'
    )
  })

  it('rejects null fileName', async () => {
    await expect(createSignedUploadUrl(TEST_USER_ID, null as any)).rejects.toThrow(
      'Invalid fileName: fileName is required and must be a non-empty string'
    )
  })

  it('rejects undefined fileName', async () => {
    await expect(createSignedUploadUrl(TEST_USER_ID, undefined as any)).rejects.toThrow(
      'Invalid fileName: fileName is required and must be a non-empty string'
    )
  })

  it('rejects whitespace-only fileName', async () => {
    await expect(createSignedUploadUrl(TEST_USER_ID, '   ')).rejects.toThrow(
      'Invalid fileName: fileName is required and must be a non-empty string'
    )
  })

  it('handles createServiceClient throwing an error', async () => {
    const fileName = 'test-image.jpg'
    ;(createServiceClient as any).mockImplementation(() => {
      throw new Error('Service client initialization failed')
    })

    await expect(createSignedUploadUrl(TEST_USER_ID, fileName)).rejects.toThrow(
      'Service client initialization failed'
    )
  })

  it('sanitizes file extensions with special characters', async () => {
    const fileName = 'test-image.jpg.exe'
    const mockSignedUrl = 'https://storage.supabase.co/signed-url'

    const storageBucket = mockStorage.from('clothing-items')
    storageBucket.createSignedUploadUrl.mockResolvedValue({
      data: {
        signedUrl: mockSignedUrl,
        path: 'test-path',
      },
      error: null,
    })

    const result = await createSignedUploadUrl(TEST_USER_ID, fileName)

    // Should use 'exe' extension (last one)
    expect(result.path).toMatch(/\.exe$/)
    expect(result.signedUrl).toBe(mockSignedUrl)
  })

  it('handles different file extensions', async () => {
    const fileName = 'test-image.jpeg'
    const mockSignedUrl = 'https://storage.supabase.co/signed-url'
    const mockPath = 'user/uploads/file.jpeg'

    const storageBucket = mockStorage.from('clothing-items')
    storageBucket.createSignedUploadUrl.mockResolvedValue({
      data: {
        signedUrl: mockSignedUrl,
        path: mockPath,
      },
      error: null,
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

