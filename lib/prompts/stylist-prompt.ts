import type { ClothingMetadata } from '@/lib/gemini/vision'

export interface ClosetItem {
  id: string
  category: string
  sub_category: string
  primary_color: string
  secondary_colors: string[]
  vibe_tags: string[]
  estimated_season: string
  last_worn_date?: string
  cost_per_wear?: number
  image_url?: string
}

export interface StylistInput {
  intent: string
  location?: string
  weather?: {
    temperature: number
    condition: string
    humidity: number
    windSpeed: number
  }
  closetItems: ClosetItem[]
}

/**
 * Builds the system prompt for the AI stylist
 */
export function getStylistSystemPrompt(): string {
  return `You are an AI stylist helping users create outfits from their wardrobe. 
Analyze the user's closet, current weather, and intent to suggest the best outfit combination.
Consider color coordination, seasonal appropriateness, and wardrobe diversity.`
}

/**
 * Builds the user prompt for the AI stylist
 */
export function buildStylistPrompt(input: StylistInput): string {
  let prompt = `User Intent: ${input.intent}\n`

  if (input.location) {
    prompt += `Location: ${input.location}\n`
  }

  if (input.weather) {
    prompt += `Current Weather: ${input.weather.temperature}°F, ${input.weather.condition}, ${input.weather.humidity}% humidity, ${input.weather.windSpeed} mph wind\n`
  }

  prompt += `\nAvailable Closet Items:\n`
  
  input.closetItems.forEach((item, index) => {
    prompt += `${index + 1}. ${item.category} - ${item.sub_category}\n`
    prompt += `   Colors: ${item.primary_color}${item.secondary_colors.length > 0 ? `, ${item.secondary_colors.join(', ')}` : ''}\n`
    prompt += `   Vibe: ${item.vibe_tags.join(', ')}\n`
    prompt += `   Season: ${item.estimated_season}\n`
    if (item.last_worn_date) {
      prompt += `   Last worn: ${item.last_worn_date}\n`
    }
    if (item.cost_per_wear) {
      prompt += `   Cost per wear: $${item.cost_per_wear.toFixed(2)}\n`
    }
    prompt += `\n`
  })

  prompt += `Task: Suggest a complete outfit (top, bottom, outerwear if needed, accessories) that:
1. Matches the weather conditions
2. Aligns with the user's intent/occasion
3. Maximizes wardrobe diversity (prefer less-worn items)
4. Creates a cohesive color palette
5. Considers seasonal appropriateness

Respond in JSON format with:
- outfit_items: [array of item IDs from the list above]
- reasoning: string explaining the choice
- color_palette: string describing the color scheme
- weather_appropriateness: string`

  return prompt
}

/**
 * Schema for stylist response
 */
export const stylistResponseSchema = {
  type: 'object',
  properties: {
    outfit_items: {
      type: 'array',
      items: {
        type: 'string',
      },
      description: 'Array of item IDs from the closet items list',
    },
    reasoning: {
      type: 'string',
      description: 'Explanation of why this outfit was chosen',
    },
    color_palette: {
      type: 'string',
      description: 'Description of the color scheme',
    },
    weather_appropriateness: {
      type: 'string',
      description: 'How well the outfit matches the weather conditions',
    },
  },
  required: ['outfit_items', 'reasoning', 'color_palette', 'weather_appropriateness'],
}

export interface StylistResponse {
  outfit_items: string[]
  reasoning: string
  color_palette: string
  weather_appropriateness: string
}

