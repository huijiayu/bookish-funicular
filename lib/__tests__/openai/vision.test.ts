import { describe, it, expect, vi, beforeEach } from 'vitest'
import { analyzeClothingImage } from '../../openai/vision'
import OpenAI from 'openai'
import { createMockOpenAIResponse, createMockClothingMetadata } from '../../../test-utils'

vi.mock('openai')

describe('analyzeClothingImage', () => {
  let mockOpenAI: any

  beforeEach(() => {
    vi.clearAllMocks()
    const OpenAIInstance = new OpenAI({ apiKey: 'test' })
    mockOpenAI = (OpenAIInstance as any)
  })

  it('calls OpenAI with correct schema', async () => {
    const imageUrl = 'https://example.com/image.jpg'
    const mockMetadata = createMockClothingMetadata()
    const mockResponse = createMockOpenAIResponse(JSON.stringify(mockMetadata))

    mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse)

    await analyzeClothingImage(imageUrl)

    expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gpt-4o-mini',
        response_format: {
          type: 'json_schema',
          json_schema: expect.objectContaining({
            name: 'clothing_metadata',
            strict: true,
            schema: expect.objectContaining({
              type: 'object',
              properties: expect.objectContaining({
                category: expect.any(Object),
                sub_category: expect.any(Object),
                primary_color: expect.any(Object),
                secondary_colors: expect.any(Object),
                vibe_tags: expect.any(Object),
                estimated_season: expect.any(Object),
              }),
            }),
          }),
        },
        max_tokens: 500,
      })
    )
  })

  it('uses low detail for cost optimization', async () => {
    const imageUrl = 'https://example.com/image.jpg'
    const mockMetadata = createMockClothingMetadata()
    const mockResponse = createMockOpenAIResponse(JSON.stringify(mockMetadata))

    mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse)

    await analyzeClothingImage(imageUrl)

    const call = mockOpenAI.chat.completions.create.mock.calls[0][0]
    const imageUrlContent = call.messages[0].content.find((c: any) => c.type === 'image_url')
    expect(imageUrlContent.image_url.detail).toBe('low')
  })

  it('includes itemDescription in prompt when provided', async () => {
    const imageUrl = 'https://example.com/image.jpg'
    const description = 'A navy blue t-shirt'
    const mockMetadata = createMockClothingMetadata()
    const mockResponse = createMockOpenAIResponse(JSON.stringify(mockMetadata))

    mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse)

    await analyzeClothingImage(imageUrl, description)

    const call = mockOpenAI.chat.completions.create.mock.calls[0][0]
    const textContent = call.messages[0].content.find((c: any) => c.type === 'text')
    expect(textContent.text).toContain(description)
  })

  it('returns structured ClothingMetadata', async () => {
    const imageUrl = 'https://example.com/image.jpg'
    const mockMetadata = createMockClothingMetadata()
    const mockResponse = createMockOpenAIResponse(JSON.stringify(mockMetadata))

    mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse)

    const result = await analyzeClothingImage(imageUrl)

    expect(result).toEqual(mockMetadata)
    expect(result.category).toBe(mockMetadata.category)
    expect(result.sub_category).toBe(mockMetadata.sub_category)
    expect(result.primary_color).toBe(mockMetadata.primary_color)
    expect(Array.isArray(result.secondary_colors)).toBe(true)
    expect(Array.isArray(result.vibe_tags)).toBe(true)
    expect(result.estimated_season).toBe(mockMetadata.estimated_season)
  })

  it('handles API errors', async () => {
    const imageUrl = 'https://example.com/image.jpg'

    mockOpenAI.chat.completions.create.mockRejectedValue(new Error('API Error'))

    await expect(analyzeClothingImage(imageUrl)).rejects.toThrow('Failed to analyze clothing image')
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

    await expect(analyzeClothingImage(imageUrl)).rejects.toThrow('Failed to analyze clothing image')
  })
})

