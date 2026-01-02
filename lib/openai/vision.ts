import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export interface ClothingMetadata {
  category: string
  sub_category: string
  primary_color: string
  secondary_colors: string[]
  vibe_tags: string[]
  estimated_season: string
}

/**
 * Analyzes a clothing item image and extracts structured metadata
 * Uses GPT-4o-mini Vision API with structured output
 */
export async function analyzeClothingImage(
  imageUrl: string,
  itemDescription?: string
): Promise<ClothingMetadata> {
  try {
    const prompt = itemDescription
      ? `Analyze this clothing item. Previous detection description: "${itemDescription}". Extract detailed metadata about this item.`
      : 'Analyze this clothing item and extract detailed metadata.'

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: prompt + ' Provide category, sub_category (e.g., t-shirt, jeans, maxi dress), primary color, secondary colors (array), vibe tags (array of style descriptors like "casual", "formal", "vintage", "minimalist"), and estimated season (spring, summer, fall, winter, or all-season).',
            },
            {
              type: 'image_url',
              image_url: {
                url: imageUrl,
                detail: 'low',
              },
            },
          ],
        },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'clothing_metadata',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              category: {
                type: 'string',
                description: 'Main category (e.g., top, bottom, dress, outerwear, accessories)',
              },
              sub_category: {
                type: 'string',
                description: 'Specific sub-category (e.g., t-shirt, jeans, maxi dress, blazer)',
              },
              primary_color: {
                type: 'string',
                description: 'Primary color name (e.g., navy blue, black, white, beige)',
              },
              secondary_colors: {
                type: 'array',
                items: {
                  type: 'string',
                },
                description: 'Array of secondary/accent colors',
              },
              vibe_tags: {
                type: 'array',
                items: {
                  type: 'string',
                },
                description: 'Array of style/vibe descriptors (e.g., casual, formal, vintage, minimalist, bohemian)',
              },
              estimated_season: {
                type: 'string',
                enum: ['spring', 'summer', 'fall', 'winter', 'all-season'],
                description: 'Estimated season appropriateness',
              },
            },
            required: ['category', 'sub_category', 'primary_color', 'secondary_colors', 'vibe_tags', 'estimated_season'],
          },
        },
      },
      max_tokens: 500,
    })

    const content = response.choices[0]?.message?.content
    if (!content) {
      throw new Error('No response from Vision API')
    }

    return JSON.parse(content) as ClothingMetadata
  } catch (error) {
    console.error('Error analyzing clothing image:', error)
    throw new Error('Failed to analyze clothing image')
  }
}

