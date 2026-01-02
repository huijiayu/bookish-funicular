import { describe, it, expect } from 'vitest'
import {
  getStylistSystemPrompt,
  buildStylistPrompt,
} from '../../prompts/stylist-prompt'
import { createMockClosetItem, createMockWeatherData } from '../../../test-utils'

describe('getStylistSystemPrompt', () => {
  it('returns correct system prompt', () => {
    const prompt = getStylistSystemPrompt()
    expect(prompt).toContain('AI stylist')
    expect(prompt).toContain('wardrobe')
    expect(prompt).toContain('outfit')
  })
})

describe('buildStylistPrompt', () => {
  it('includes intent', () => {
    const input = {
      intent: 'casual day out',
      closetItems: [],
    }
    const prompt = buildStylistPrompt(input)
    expect(prompt).toContain('casual day out')
    expect(prompt).toContain('User Intent:')
  })

  it('includes location when provided', () => {
    const input = {
      intent: 'casual day out',
      location: 'New York',
      closetItems: [],
    }
    const prompt = buildStylistPrompt(input)
    expect(prompt).toContain('New York')
    expect(prompt).toContain('Location:')
  })

  it('includes weather when provided', () => {
    const input = {
      intent: 'casual day out',
      location: 'New York',
      weather: createMockWeatherData(),
      closetItems: [],
    }
    const prompt = buildStylistPrompt(input)
    expect(prompt).toContain('72°F')
    expect(prompt).toContain('Clear')
    expect(prompt).toContain('65% humidity')
    expect(prompt).toContain('5 mph wind')
    expect(prompt).toContain('Current Weather:')
  })

  it('formats closet items correctly', () => {
    const input = {
      intent: 'casual day out',
      closetItems: [
        createMockClosetItem({
          id: 'item-1',
          category: 'top',
          sub_category: 't-shirt',
          primary_color: 'navy blue',
          secondary_colors: ['white'],
          vibe_tags: ['casual', 'minimalist'],
          estimated_season: 'all-season',
          last_worn_date: '2024-01-15',
          cost_per_wear: 25.50,
        }),
      ],
    }
    const prompt = buildStylistPrompt(input)

    expect(prompt).toContain('top - t-shirt')
    expect(prompt).toContain('navy blue')
    expect(prompt).toContain('white')
    expect(prompt).toContain('casual, minimalist')
    expect(prompt).toContain('all-season')
    expect(prompt).toContain('2024-01-15')
    expect(prompt).toContain('$25.50')
  })

  it('includes all item metadata', () => {
    const input = {
      intent: 'casual day out',
      closetItems: [
        createMockClosetItem({
          category: 'top',
          sub_category: 't-shirt',
          primary_color: 'navy blue',
          secondary_colors: ['white', 'red'],
          vibe_tags: ['casual', 'minimalist', 'vintage'],
          estimated_season: 'summer',
          last_worn_date: '2024-01-15',
          cost_per_wear: 25.50,
        }),
      ],
    }
    const prompt = buildStylistPrompt(input)

    expect(prompt).toContain('Colors: navy blue, white, red')
    expect(prompt).toContain('Vibe: casual, minimalist, vintage')
    expect(prompt).toContain('Season: summer')
    expect(prompt).toContain('Last worn: 2024-01-15')
    expect(prompt).toContain('Cost per wear: $25.50')
  })

  it('handles items without secondary colors', () => {
    const input = {
      intent: 'casual day out',
      closetItems: [
        createMockClosetItem({
          primary_color: 'navy blue',
          secondary_colors: [],
        }),
      ],
    }
    const prompt = buildStylistPrompt(input)

    expect(prompt).toContain('Colors: navy blue')
    expect(prompt).not.toContain('Colors: navy blue,')
  })

  it('handles items without last_worn_date', () => {
    const input = {
      intent: 'casual day out',
      closetItems: [
        createMockClosetItem({
          last_worn_date: undefined,
        }),
      ],
    }
    const prompt = buildStylistPrompt(input)

    expect(prompt).not.toContain('Last worn:')
  })

  it('handles items without cost_per_wear', () => {
    const input = {
      intent: 'casual day out',
      closetItems: [
        createMockClosetItem({
          cost_per_wear: undefined,
        }),
      ],
    }
    const prompt = buildStylistPrompt(input)

    // Should still include the item, just without CPW
    expect(prompt).toContain('Available Closet Items:')
  })

  it('builds task description correctly', () => {
    const input = {
      intent: 'casual day out',
      closetItems: [],
    }
    const prompt = buildStylistPrompt(input)

    expect(prompt).toContain('Task:')
    expect(prompt).toContain('weather conditions')
    expect(prompt).toContain('user\'s intent')
    expect(prompt).toContain('wardrobe diversity')
    expect(prompt).toContain('color palette')
    expect(prompt).toContain('seasonal appropriateness')
  })

  it('includes JSON format requirements', () => {
    const input = {
      intent: 'casual day out',
      closetItems: [],
    }
    const prompt = buildStylistPrompt(input)

    expect(prompt).toContain('JSON format')
    expect(prompt).toContain('outfit_items')
    expect(prompt).toContain('reasoning')
    expect(prompt).toContain('color_palette')
    expect(prompt).toContain('weather_appropriateness')
  })
})

