'use server'

import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'
import { getCurrentWeather } from '@/lib/weather/openweather'
import {
  buildStylistPrompt,
  getStylistSystemPrompt,
  stylistResponseSchema,
  type StylistInput,
  type StylistResponse,
  type ClosetItem,
} from '@/lib/prompts/stylist-prompt'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

/**
 * Gets stylist suggestion based on user intent, weather, and closet data
 */
export async function getStylistSuggestion(
  userId: string,
  intent: string,
  location?: string
): Promise<StylistResponse & { items: ClosetItem[] }> {
  const supabase = await createClient()

  // Step 1: Fetch weather if location provided
  let weather
  if (location) {
    try {
      weather = await getCurrentWeather(location)
    } catch (error) {
      console.error('Error fetching weather:', error)
      // Continue without weather data
    }
  }

  // Step 2: Query user's closet with recent wear data
  const { data: clothingItems, error: itemsError } = await supabase
    .from('clothing_items')
    .select(`
      id,
      image_urls,
      ai_metadata,
      price,
      initial_wears,
      wear_events (
        worn_at
      )
    `)
    .eq('user_id', userId)

  if (itemsError) {
    throw new Error('Failed to fetch closet items')
  }

  // Step 3: Format closet items
  const closetItems: ClosetItem[] = (clothingItems || []).map((item: any) => {
    const metadata = item.ai_metadata || {}
    const wearEvents = item.wear_events || []
    const lastWorn = wearEvents.length > 0
      ? new Date(
          Math.max(
            ...wearEvents.map((e: any) => new Date(e.worn_at).getTime())
          )
        ).toISOString().split('T')[0]
      : undefined

    const totalWears = item.initial_wears + wearEvents.length
    const costPerWear =
      totalWears > 0 ? Number(item.price || 0) / totalWears : Number(item.price || 0)

    const imageUrls = item.image_urls || { primary: '', variants: [] }
    const imageUrl = imageUrls.primary || imageUrls.variants?.[0] || ''

    return {
      id: item.id,
      category: metadata.category || 'unknown',
      sub_category: metadata.sub_category || '',
      primary_color: metadata.primary_color || '',
      secondary_colors: metadata.secondary_colors || [],
      vibe_tags: metadata.vibe_tags || [],
      estimated_season: metadata.estimated_season || 'all-season',
      last_worn_date: lastWorn,
      cost_per_wear: costPerWear,
      image_url: imageUrl,
    }
  })

  if (closetItems.length === 0) {
    throw new Error('No items in closet')
  }

  // Step 4: Build prompt
  const input: StylistInput = {
    intent,
    location,
    weather,
    closetItems,
  }

  const systemPrompt = getStylistSystemPrompt()
  const userPrompt = buildStylistPrompt(input)

  // Step 5: Call OpenAI
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: systemPrompt,
      },
      {
        role: 'user',
        content: userPrompt,
      },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'stylist_suggestion',
        strict: true,
        schema: stylistResponseSchema,
      },
    },
    max_tokens: 500,
  })

  const content = response.choices[0]?.message?.content
  if (!content) {
    throw new Error('No response from OpenAI')
  }

  const suggestion = JSON.parse(content) as StylistResponse

  // Step 6: Get full item details for the suggested outfit
  const suggestedItems = closetItems.filter((item) =>
    suggestion.outfit_items.includes(item.id)
  )

  return {
    ...suggestion,
    items: suggestedItems,
  }
}

