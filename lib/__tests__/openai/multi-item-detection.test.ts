import { describe, it, expect, vi, beforeEach } from 'vitest'
import { detectClothingItems } from '../../openai/multi-item-detection'
import { createMockOpenAIResponse, createMockDetectedItem } from '../../../test-utils'

vi.mock('openai', () => {
  const mockOpenAI = {
    chat: {
      completions: {
        create: vi.fn(),
      },
    },
  }
  return {
    default: vi.fn(() => mockOpenAI),
  }
})

import OpenAI from 'openai'

describe('detectClothingItems', () => {
  let mockOpenAI: any

  beforeEach(() => {
    vi.clearAllMocks()
    const OpenAIInstance = new OpenAI({ apiKey: 'test' })
    mockOpenAI = (OpenAIInstance as any)
  })

  it('calls OpenAI with correct detection schema', async () => {
    const imageUrl = 'https://example.com/image.jpg'
    const mockItems = [createMockDetectedItem()]
    const mockResponse = createMockOpenAIResponse(
      JSON.stringify({ items: mockItems })
    )

    mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse)

    await detectClothingItems(imageUrl)

    expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gpt-4o-mini',
        response_format: {
          type: 'json_schema',
          json_schema: expect.objectContaining({
            name: 'clothing_items_detection',
            strict: true,
            schema: expect.objectContaining({
              type: 'object',
              properties: expect.objectContaining({
                items: expect.any(Object),
              }),
            }),
          }),
        },
        max_tokens: 1000,
      })
    )
  })

  it('filters items by confidence > 0.5', async () => {
    const imageUrl = 'https://example.com/image.jpg'
    const highConfidenceItem = createMockDetectedItem({ confidence: 0.9 })
    const lowConfidenceItem = createMockDetectedItem({ confidence: 0.3 })
    const mockResponse = createMockOpenAIResponse(
      JSON.stringify({ items: [highConfidenceItem, lowConfidenceItem] })
    )

    mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse)

    const result = await detectClothingItems(imageUrl)

    expect(result).toHaveLength(1)
    expect(result[0].confidence).toBe(0.9)
  })

  it('returns DetectedItem[] with bounding boxes', async () => {
    const imageUrl = 'https://example.com/image.jpg'
    const mockItems = [
      createMockDetectedItem({
        description: 'A navy blue t-shirt',
        category: 'top',
        bounding_box: { x: 10, y: 20, width: 30, height: 40 },
        confidence: 0.9,
      }),
    ]
    const mockResponse = createMockOpenAIResponse(
      JSON.stringify({ items: mockItems })
    )

    mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse)

    const result = await detectClothingItems(imageUrl)

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      description: 'A navy blue t-shirt',
      category: 'top',
      bounding_box: { x: 10, y: 20, width: 30, height: 40 },
      confidence: 0.9,
    })
  })

  it('handles API errors', async () => {
    const imageUrl = 'https://example.com/image.jpg'

    mockOpenAI.chat.completions.create.mockRejectedValue(new Error('API Error'))

    await expect(detectClothingItems(imageUrl)).rejects.toThrow(
      'Failed to detect clothing items in image'
    )
  })

  it('handles empty response', async () => {
    const imageUrl = 'https://example.com/image.jpg'
    const mockResponse = {
      choices: [
        {
          message: {
            content: null,
          },
        },
      ],
    }

    mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse)

    await expect(detectClothingItems(imageUrl)).rejects.toThrow(
      'Failed to detect clothing items in image'
    )
  })

  it('returns empty array when all items have low confidence', async () => {
    const imageUrl = 'https://example.com/image.jpg'
    const lowConfidenceItems = [
      createMockDetectedItem({ confidence: 0.3 }),
      createMockDetectedItem({ confidence: 0.4 }),
    ]
    const mockResponse = createMockOpenAIResponse(
      JSON.stringify({ items: lowConfidenceItems })
    )

    mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse)

    const result = await detectClothingItems(imageUrl)

    expect(result).toHaveLength(0)
  })
})

