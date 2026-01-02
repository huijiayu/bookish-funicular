import { describe, it, expect, vi, beforeEach } from 'vitest'
import { generatePerceptualHash, hammingDistance } from '../perceptual-hash'

// Mock sharp
const mockSharpInstance = {
  metadata: vi.fn(),
  extract: vi.fn().mockReturnThis(),
  greyscale: vi.fn().mockReturnThis(),
  resize: vi.fn().mockReturnThis(),
  raw: vi.fn().mockReturnThis(),
  toBuffer: vi.fn(),
}

vi.mock('sharp', () => {
  const mockSharp = vi.fn(() => mockSharpInstance)
  return { default: mockSharp }
})

import sharp from 'sharp'

// Mock fetch
global.fetch = vi.fn()

describe('generatePerceptualHash', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset mock return values
    mockSharpInstance.metadata.mockResolvedValue({
      width: 100,
      height: 100,
    } as any)
    mockSharpInstance.extract.mockReturnThis()
    mockSharpInstance.greyscale.mockReturnThis()
    mockSharpInstance.resize.mockReturnThis()
    mockSharpInstance.raw.mockReturnThis()
    mockSharpInstance.toBuffer.mockResolvedValue(Buffer.from([100, 150, 200, 50, 100, 150, 200, 50]))
  })

  it('generates hash for full image', async () => {
    const imageUrl = 'https://example.com/image.jpg'
    const mockBuffer = Buffer.from([1, 2, 3, 4, 5, 6, 7, 8])

    ;(global.fetch as any).mockResolvedValue({
      ok: true,
      arrayBuffer: async () => mockBuffer.buffer,
    })

    const hash = await generatePerceptualHash(imageUrl)

    expect(hash).toBeTruthy()
    expect(typeof hash).toBe('string')
    expect(global.fetch).toHaveBeenCalledWith(imageUrl)
    expect(sharp).toHaveBeenCalled()
  })

  it('crops image correctly when bounding box provided', async () => {
    const imageUrl = 'https://example.com/image.jpg'
    const boundingBox = { x: 10, y: 20, width: 30, height: 40 }
    const mockBuffer = Buffer.from([1, 2, 3, 4])

    ;(global.fetch as any).mockResolvedValue({
      ok: true,
      arrayBuffer: async () => mockBuffer.buffer,
    })

    await generatePerceptualHash(imageUrl, boundingBox)

    expect(mockSharpInstance.extract).toHaveBeenCalledWith({
      left: 10,
      top: 20,
      width: 30,
      height: 40,
    })
  })

  it('handles edge cases with boundaries', async () => {
    const imageUrl = 'https://example.com/image.jpg'
    const boundingBox = { x: -10, y: 120, width: 150, height: 50 }
    const mockBuffer = Buffer.from([1, 2, 3, 4])

    ;(global.fetch as any).mockResolvedValue({
      ok: true,
      arrayBuffer: async () => mockBuffer.buffer,
    })

    await generatePerceptualHash(imageUrl, boundingBox)

    // Should clamp coordinates to valid bounds
    expect(mockSharpInstance.extract).toHaveBeenCalled()
    const extractCall = mockSharpInstance.extract.mock.calls[0][0] as any
    expect(extractCall.left).toBeGreaterThanOrEqual(0)
    expect(extractCall.top).toBeGreaterThanOrEqual(0)
    expect(extractCall.width).toBeGreaterThan(0)
    expect(extractCall.height).toBeGreaterThan(0)
  })

  it('converts to grayscale and resizes to 8x8', async () => {
    const imageUrl = 'https://example.com/image.jpg'
    const mockBuffer = Buffer.from([1, 2, 3, 4])

    ;(global.fetch as any).mockResolvedValue({
      ok: true,
      arrayBuffer: async () => mockBuffer.buffer,
    })

    await generatePerceptualHash(imageUrl)

    expect(mockSharpInstance.greyscale).toHaveBeenCalled()
    expect(mockSharpInstance.resize).toHaveBeenCalledWith(8, 8, { fit: 'fill' })
    expect(mockSharpInstance.raw).toHaveBeenCalled()
  })

  it('returns binary hash string', async () => {
    const imageUrl = 'https://example.com/image.jpg'
    const mockBuffer = Buffer.from([1, 2, 3, 4])

    ;(global.fetch as any).mockResolvedValue({
      ok: true,
      arrayBuffer: async () => mockBuffer.buffer,
    })

    const hash = await generatePerceptualHash(imageUrl)

    expect(hash).toBeTruthy()
    expect(hash.length).toBeGreaterThan(0)
    // Hash should be binary (0s and 1s)
    expect(/^[01]+$/.test(hash)).toBe(true)
  })

  it('handles fetch errors', async () => {
    const imageUrl = 'https://example.com/image.jpg'

    ;(global.fetch as any).mockResolvedValue({
      ok: false,
      statusText: 'Not Found',
    })

    await expect(generatePerceptualHash(imageUrl)).rejects.toThrow('Failed to generate perceptual hash')
  })
})

describe('hammingDistance', () => {
  it('calculates distance correctly', () => {
    const hash1 = '10101010'
    const hash2 = '10101011'
    const distance = hammingDistance(hash1, hash2)
    expect(distance).toBe(1)
  })

  it('returns 0 for identical hashes', () => {
    const hash1 = '10101010'
    const hash2 = '10101010'
    const distance = hammingDistance(hash1, hash2)
    expect(distance).toBe(0)
  })

  it('calculates distance for completely different hashes', () => {
    const hash1 = '00000000'
    const hash2 = '11111111'
    const distance = hammingDistance(hash1, hash2)
    expect(distance).toBe(8)
  })

  it('throws error for unequal length hashes', () => {
    const hash1 = '1010'
    const hash2 = '101010'
    expect(() => hammingDistance(hash1, hash2)).toThrow('Hashes must be of equal length')
  })
})

