import { describe, it, expect, vi, beforeEach } from 'vitest'
import { generateImageEmbedding } from '../../openai/embeddings'
import OpenAI from 'openai'
import sharp from 'sharp'
import { createMockOpenAIResponse, createMockEmbeddingResponse } from '../../../test-utils'

vi.mock('openai')
vi.mock('sharp')

// Mock fetch
global.fetch = vi.fn()

describe('generateImageEmbedding', () => {
  let mockOpenAI: any
  let mockSharpInstance: any

  beforeEach(() => {
    vi.clearAllMocks()
    mockOpenAI = {
      chat: {
        completions: {
          create: vi.fn(),
        },
      },
      embeddings: {
        create: vi.fn(),
      },
    }
    ;(OpenAI as any).mockImplementation(() => mockOpenAI)

    mockSharpInstance = {
      metadata: vi.fn(),
      extract: vi.fn().mockReturnThis(),
      toBuffer: vi.fn(),
    }
    ;(sharp as any).mockImplementation(() => mockSharpInstance)
  })

  it('crops image when bounding box provided', async () => {
    const imageUrl = 'https://example.com/image.jpg'
    const boundingBox = { x: 10, y: 20, width: 30, height: 40 }
    const mockBuffer = Buffer.from([1, 2, 3, 4])
    const croppedBuffer = Buffer.from([5, 6, 7, 8])
    const mockDescription = 'A detailed description of the clothing item'
    const mockEmbedding = [0.1, 0.2, 0.3]

    ;(global.fetch as any).mockResolvedValue({
      ok: true,
      arrayBuffer: async () => mockBuffer.buffer,
    })

    vi.mocked(mockSharpInstance.metadata).mockResolvedValue({
      width: 100,
      height: 100,
    } as any)
    vi.mocked(mockSharpInstance.extract).mockReturnThis()
    vi.mocked(mockSharpInstance.toBuffer).mockResolvedValue(croppedBuffer)

    mockOpenAI.chat.completions.create.mockResolvedValue(
      createMockOpenAIResponse(mockDescription)
    )
    mockOpenAI.embeddings.create.mockResolvedValue(
      createMockEmbeddingResponse(mockEmbedding)
    )

    await generateImageEmbedding(imageUrl, boundingBox)

    expect(mockSharpInstance.extract).toHaveBeenCalled()
    expect(mockOpenAI.chat.completions.create).toHaveBeenCalled()
    expect(mockOpenAI.embeddings.create).toHaveBeenCalled()
  })

  it('gets description from Vision API', async () => {
    const imageUrl = 'https://example.com/image.jpg'
    const mockDescription = 'A detailed description of the clothing item'
    const mockEmbedding = [0.1, 0.2, 0.3]

    mockOpenAI.chat.completions.create.mockResolvedValue(
      createMockOpenAIResponse(mockDescription)
    )
    mockOpenAI.embeddings.create.mockResolvedValue(
      createMockEmbeddingResponse(mockEmbedding)
    )

    await generateImageEmbedding(imageUrl)

    expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gpt-4o-mini',
        messages: expect.arrayContaining([
          expect.objectContaining({
            content: expect.arrayContaining([
              expect.objectContaining({
                type: 'text',
                text: expect.stringContaining('detailed, structured description'),
              }),
            ]),
          }),
        ]),
      })
    )
  })

  it('embeds description using text-embedding-3-small', async () => {
    const imageUrl = 'https://example.com/image.jpg'
    const mockDescription = 'A detailed description'
    const mockEmbedding = [0.1, 0.2, 0.3]

    mockOpenAI.chat.completions.create.mockResolvedValue(
      createMockOpenAIResponse(mockDescription)
    )
    mockOpenAI.embeddings.create.mockResolvedValue(
      createMockEmbeddingResponse(mockEmbedding)
    )

    await generateImageEmbedding(imageUrl)

    expect(mockOpenAI.embeddings.create).toHaveBeenCalledWith({
      model: 'text-embedding-3-small',
      input: mockDescription,
    })
  })

  it('returns embedding vector', async () => {
    const imageUrl = 'https://example.com/image.jpg'
    const mockDescription = 'A detailed description'
    const mockEmbedding = [0.1, 0.2, 0.3, 0.4, 0.5]

    mockOpenAI.chat.completions.create.mockResolvedValue(
      createMockOpenAIResponse(mockDescription)
    )
    mockOpenAI.embeddings.create.mockResolvedValue(
      createMockEmbeddingResponse(mockEmbedding)
    )

    const result = await generateImageEmbedding(imageUrl)

    expect(result).toEqual(mockEmbedding)
    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBe(5)
  })

  it('handles errors', async () => {
    const imageUrl = 'https://example.com/image.jpg'

    mockOpenAI.chat.completions.create.mockRejectedValue(new Error('API Error'))

    await expect(generateImageEmbedding(imageUrl)).rejects.toThrow(
      'Failed to generate image embedding'
    )
  })

  it('handles fetch errors when cropping', async () => {
    const imageUrl = 'https://example.com/image.jpg'
    const boundingBox = { x: 10, y: 20, width: 30, height: 40 }

    ;(global.fetch as any).mockResolvedValue({
      ok: false,
      statusText: 'Not Found',
    })

    await expect(generateImageEmbedding(imageUrl, boundingBox)).rejects.toThrow(
      'Failed to generate image embedding'
    )
  })
})

