import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export interface DetectedItem {
  description: string
  category: string
  bounding_box: {
    x: number
    y: number
    width: number
    height: number
  }
  confidence: number
}

export interface DetectionResponse {
  items: DetectedItem[]
}

/**
 * Detects multiple clothing items in an uploaded image
 * Uses GPT-4o-mini Vision API with structured output
 */
export async function detectClothingItems(imageUrl: string): Promise<DetectedItem[]> {
  // Validate OpenAI API key
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not configured. Please set it in your .env.local file.')
  }

  // Validate image URL
  if (!imageUrl || typeof imageUrl !== 'string' || imageUrl.trim() === '') {
    throw new Error('Invalid image URL: imageUrl is required and must be a non-empty string')
  }

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Analyze this image and identify all distinct clothing items. For each item, provide a description, estimated bounding box coordinates (as percentages of image dimensions), category (e.g., shirt, pants, dress, jacket), and confidence level (0-1). Return only the clothing items, not accessories like bags or shoes unless they are the main focus.',
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
          name: 'clothing_items_detection',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              items: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    description: {
                      type: 'string',
                      description: 'Detailed description of the clothing item',
                    },
                    category: {
                      type: 'string',
                      description: 'Category of the clothing item (e.g., shirt, pants, dress, jacket, sweater)',
                    },
                    bounding_box: {
                      type: 'object',
                      properties: {
                        x: {
                          type: 'number',
                          description: 'X coordinate of top-left corner as percentage (0-100)',
                        },
                        y: {
                          type: 'number',
                          description: 'Y coordinate of top-left corner as percentage (0-100)',
                        },
                        width: {
                          type: 'number',
                          description: 'Width as percentage of image (0-100)',
                        },
                        height: {
                          type: 'number',
                          description: 'Height as percentage of image (0-100)',
                        },
                      },
                      required: ['x', 'y', 'width', 'height'],
                    },
                    confidence: {
                      type: 'number',
                      description: 'Confidence level between 0 and 1',
                      minimum: 0,
                      maximum: 1,
                    },
                  },
                  required: ['description', 'category', 'bounding_box', 'confidence'],
                },
              },
            },
            required: ['items'],
          },
        },
      },
      max_tokens: 1000,
    })

    if (!response.choices || response.choices.length === 0) {
      throw new Error('OpenAI API returned no choices in the response')
    }

    const content = response.choices[0]?.message?.content
    if (!content) {
      throw new Error('OpenAI API returned empty content. The model may have failed to generate a response.')
    }

    let parsed: DetectionResponse
    try {
      parsed = JSON.parse(content) as DetectionResponse
    } catch (parseError) {
      console.error('Failed to parse OpenAI response as JSON:', content)
      throw new Error(`Failed to parse OpenAI response as JSON: ${parseError instanceof Error ? parseError.message : 'Unknown parsing error'}`)
    }

    if (!parsed.items || !Array.isArray(parsed.items)) {
      throw new Error('OpenAI API response is missing or invalid "items" array')
    }

    const filteredItems = parsed.items.filter(item => {
      // Validate item structure
      if (!item.description || !item.category || !item.bounding_box || typeof item.confidence !== 'number') {
        console.warn('Skipping invalid item:', item)
        return false
      }
      return item.confidence > 0.5
    })

    if (filteredItems.length === 0 && parsed.items.length > 0) {
      console.warn(`All ${parsed.items.length} detected items were filtered out due to low confidence (< 0.5)`)
    }

    return filteredItems
  } catch (error) {
    console.error('Error detecting clothing items:', error)
    
    // Provide more specific error messages
    if (error instanceof Error) {
      // Check for API key errors
      if (error.message.includes('API key') || error.message.includes('authentication')) {
        throw new Error('OpenAI API authentication failed. Please check that OPENAI_API_KEY is set correctly in your .env.local file.')
      }
      
      // Check for rate limit errors
      if (error.message.includes('rate limit') || error.message.includes('429')) {
        throw new Error('OpenAI API rate limit exceeded. Please wait a moment and try again.')
      }
      
      // Check for invalid image URL errors
      if (error.message.includes('image') && (error.message.includes('invalid') || error.message.includes('not found'))) {
        throw new Error(`Failed to access image at URL: ${imageUrl.substring(0, 100)}... The image may not be publicly accessible or the URL may be invalid.`)
      }
      
      // Check for JSON schema errors
      if (error.message.includes('json_schema') || error.message.includes('response_format')) {
        throw new Error('OpenAI API response format error. The model may not support structured outputs. Please check your OpenAI API plan.')
      }
      
      // Re-throw with original message if it's already descriptive, but ensure it includes our standard message
      if (error.message.includes('Failed to detect clothing items')) {
        throw error
      }
      throw new Error(`Failed to detect clothing items in image: ${error.message}`)
    }
    
    throw new Error(`Failed to detect clothing items in image: ${error instanceof Error ? error.message : 'Unknown error occurred'}`)
  }
}
