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

    const content = response.choices[0]?.message?.content
    if (!content) {
      throw new Error('No response from Vision API')
    }

    const parsed = JSON.parse(content) as DetectionResponse
    return parsed.items.filter(item => item.confidence > 0.5) // Filter low confidence items
  } catch (error) {
    console.error('Error detecting clothing items:', error)
    throw new Error('Failed to detect clothing items in image')
  }
}

