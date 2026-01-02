import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getStylistSuggestion } from '../stylist'
import { createClient } from '@/lib/supabase/server'
import { getCurrentWeather } from '@/lib/weather/openweather'
import OpenAI from 'openai'
import {
  TEST_USER_ID,
  createMockClothingItem,
  createMockWeatherData,
  createMockOpenAIResponse,
} from '../../../test-utils'

vi.mock('@/lib/supabase/server')
vi.mock('@/lib/weather/openweather')
vi.mock('openai')

describe('getStylistSuggestion', () => {
  let mockSupabase: any
  let mockQueryBuilder: any
  let mockOpenAI: any

  beforeEach(() => {
    vi.clearAllMocks()

    mockQueryBuilder = {
      select: vi.fn(function(this: any) { return this; }),
      eq: vi.fn(function(this: any) { return this; }),
    }

    mockSupabase = {
      from: vi.fn(() => mockQueryBuilder),
    }

    mockOpenAI = {
      chat: {
        completions: {
          create: vi.fn(),
        },
      },
    }

    ;(createClient as any).mockResolvedValue(mockSupabase)
    ;(OpenAI as any).mockImplementation(() => mockOpenAI)
  })

  it('fetches weather when location provided', async () => {
    const location = 'New York'
    const intent = 'casual day out'
    const mockItems = [createMockClothingItem()]
    const mockWeather = createMockWeatherData()
    const mockSuggestion = {
      outfit_items: ['item-1'],
      reasoning: 'Great outfit',
      color_palette: 'Navy and white',
      weather_appropriateness: 'Perfect for the weather',
    }

    mockQueryBuilder.select.mockResolvedValue({
      data: mockItems,
      error: null,
    })
    vi.mocked(getCurrentWeather).mockResolvedValue(mockWeather)
    mockOpenAI.chat.completions.create.mockResolvedValue(
      createMockOpenAIResponse(JSON.stringify(mockSuggestion))
    )

    await getStylistSuggestion(TEST_USER_ID, intent, location)

    expect(getCurrentWeather).toHaveBeenCalledWith(location)
  })

  it('continues without weather on error', async () => {
    const location = 'New York'
    const intent = 'casual day out'
    const mockItems = [createMockClothingItem()]
    const mockSuggestion = {
      outfit_items: ['item-1'],
      reasoning: 'Great outfit',
      color_palette: 'Navy and white',
      weather_appropriateness: 'Perfect for the weather',
    }

    mockQueryBuilder.select.mockResolvedValue({
      data: mockItems,
      error: null,
    })
    vi.mocked(getCurrentWeather).mockRejectedValue(new Error('Weather API error'))
    mockOpenAI.chat.completions.create.mockResolvedValue(
      createMockOpenAIResponse(JSON.stringify(mockSuggestion))
    )

    // Should not throw
    await expect(
      getStylistSuggestion(TEST_USER_ID, intent, location)
    ).resolves.toBeDefined()
  })

  it('formats closet items correctly (calculates CPW, last_worn_date)', async () => {
    const intent = 'casual day out'
    const mockItems = [
      createMockClothingItem({
        id: 'item-1',
        price: 100,
        initial_wears: 1,
        wear_events: [
          { worn_at: '2024-01-15T00:00:00Z' },
          { worn_at: '2024-01-20T00:00:00Z' },
        ],
      }),
    ]
    const mockSuggestion = {
      outfit_items: ['item-1'],
      reasoning: 'Great outfit',
      color_palette: 'Navy and white',
      weather_appropriateness: 'Perfect for the weather',
    }

    mockQueryBuilder.select.mockResolvedValue({
      data: mockItems,
      error: null,
    })
    mockOpenAI.chat.completions.create.mockResolvedValue(
      createMockOpenAIResponse(JSON.stringify(mockSuggestion))
    )

    const result = await getStylistSuggestion(TEST_USER_ID, intent)

    expect(result.items).toHaveLength(1)
    expect(result.items[0].cost_per_wear).toBe(100 / (1 + 2)) // 33.33
    expect(result.items[0].last_worn_date).toBe('2024-01-20')
  })

  it('builds prompt correctly with all data', async () => {
    const intent = 'casual day out'
    const location = 'New York'
    const mockItems = [createMockClothingItem()]
    const mockWeather = createMockWeatherData()
    const mockSuggestion = {
      outfit_items: ['item-1'],
      reasoning: 'Great outfit',
      color_palette: 'Navy and white',
      weather_appropriateness: 'Perfect for the weather',
    }

    mockQueryBuilder.select.mockResolvedValue({
      data: mockItems,
      error: null,
    })
    vi.mocked(getCurrentWeather).mockResolvedValue(mockWeather)
    mockOpenAI.chat.completions.create.mockResolvedValue(
      createMockOpenAIResponse(JSON.stringify(mockSuggestion))
    )

    await getStylistSuggestion(TEST_USER_ID, intent, location)

    const call = mockOpenAI.chat.completions.create.mock.calls[0][0]
    const userPrompt = call.messages.find((m: any) => m.role === 'user')?.content
    expect(userPrompt).toContain(intent)
    expect(userPrompt).toContain(location)
    expect(userPrompt).toContain('72°F')
  })

  it('calls OpenAI with correct schema', async () => {
    const intent = 'casual day out'
    const mockItems = [createMockClothingItem()]
    const mockSuggestion = {
      outfit_items: ['item-1'],
      reasoning: 'Great outfit',
      color_palette: 'Navy and white',
      weather_appropriateness: 'Perfect for the weather',
    }

    mockQueryBuilder.select.mockResolvedValue({
      data: mockItems,
      error: null,
    })
    mockOpenAI.chat.completions.create.mockResolvedValue(
      createMockOpenAIResponse(JSON.stringify(mockSuggestion))
    )

    await getStylistSuggestion(TEST_USER_ID, intent)

    expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gpt-4o-mini',
        response_format: {
          type: 'json_schema',
          json_schema: expect.objectContaining({
            name: 'stylist_suggestion',
            strict: true,
          }),
        },
        max_tokens: 500,
      })
    )
  })

  it('filters suggested items from closet', async () => {
    const intent = 'casual day out'
    const mockItems = [
      createMockClothingItem({ id: 'item-1' }),
      createMockClothingItem({ id: 'item-2' }),
      createMockClothingItem({ id: 'item-3' }),
    ]
    const mockSuggestion = {
      outfit_items: ['item-1', 'item-3'],
      reasoning: 'Great outfit',
      color_palette: 'Navy and white',
      weather_appropriateness: 'Perfect for the weather',
    }

    mockQueryBuilder.select.mockResolvedValue({
      data: mockItems,
      error: null,
    })
    mockOpenAI.chat.completions.create.mockResolvedValue(
      createMockOpenAIResponse(JSON.stringify(mockSuggestion))
    )

    const result = await getStylistSuggestion(TEST_USER_ID, intent)

    expect(result.items).toHaveLength(2)
    expect(result.items.map((i) => i.id)).toEqual(['item-1', 'item-3'])
  })

  it('throws error when no items in closet', async () => {
    const intent = 'casual day out'

    mockQueryBuilder.select.mockResolvedValue({
      data: [],
      error: null,
    })

    await expect(getStylistSuggestion(TEST_USER_ID, intent)).rejects.toThrow(
      'No items in closet'
    )
  })

  it('handles items without wear events', async () => {
    const intent = 'casual day out'
    const mockItems = [
      createMockClothingItem({
        id: 'item-1',
        price: 100,
        initial_wears: 0,
        wear_events: [],
      }),
    ]
    const mockSuggestion = {
      outfit_items: ['item-1'],
      reasoning: 'Great outfit',
      color_palette: 'Navy and white',
      weather_appropriateness: 'Perfect for the weather',
    }

    mockQueryBuilder.select.mockResolvedValue({
      data: mockItems,
      error: null,
    })
    mockOpenAI.chat.completions.create.mockResolvedValue(
      createMockOpenAIResponse(JSON.stringify(mockSuggestion))
    )

    const result = await getStylistSuggestion(TEST_USER_ID, intent)

    expect(result.items[0].cost_per_wear).toBe(100) // Should return price when no wears
    expect(result.items[0].last_worn_date).toBeUndefined()
  })
})

