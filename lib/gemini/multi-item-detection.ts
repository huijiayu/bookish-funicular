import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

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
 * Sleep utility for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Detects multiple clothing items in an uploaded image
 * Uses Google Gemini 1.5 Flash (free tier) with vision capabilities
 * Includes retry logic with exponential backoff for rate limit errors
 */
export async function detectClothingItems(imageUrl: string): Promise<DetectedItem[]> {
  // Validate Gemini API key
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not configured. Please set it in your .env.local file.')
  }

  // Validate image URL
  if (!imageUrl || typeof imageUrl !== 'string' || imageUrl.trim() === '') {
    throw new Error('Invalid image URL: imageUrl is required and must be a non-empty string')
  }

  const maxRetries = 3
  let lastError: Error | null = null

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Use gemini-2.5-flash which supports vision
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

      const prompt = `Analyze this image and identify all distinct clothing items. For each item, provide a description, estimated bounding box coordinates (as percentages of image dimensions), category (e.g., shirt, pants, dress, jacket), and confidence level (0-1). Return only the clothing items, not accessories like bags or shoes unless they are the main focus.

Return your response as a valid JSON object with this exact structure:
{
  "items": [
    {
      "description": "detailed description",
      "category": "category name",
      "bounding_box": {
        "x": 0-100,
        "y": 0-100,
        "width": 0-100,
        "height": 0-100
      },
      "confidence": 0-1
    }
  ]
}`

      const result = await model.generateContent([
        prompt,
        {
          inlineData: {
            data: await fetchImageAsBase64(imageUrl),
            mimeType: 'image/jpeg',
          },
        },
      ])

      const response = await result.response
      const text = response.text()

      // Parse JSON from response (Gemini may wrap it in markdown code blocks)
      let jsonText = text.trim()
      // Remove markdown code blocks if present
      if (jsonText.startsWith('```json')) {
        jsonText = jsonText.replace(/^```json\s*/, '').replace(/\s*```$/, '')
      } else if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/^```\s*/, '').replace(/\s*```$/, '')
      }

      let parsed: DetectionResponse
      try {
        parsed = JSON.parse(jsonText) as DetectionResponse
      } catch (parseError) {
        console.error('Failed to parse Gemini response as JSON:', text)
        throw new Error(`Failed to parse Gemini response as JSON: ${parseError instanceof Error ? parseError.message : 'Unknown parsing error'}`)
      }

      if (!parsed.items || !Array.isArray(parsed.items)) {
        throw new Error('Gemini API response is missing or invalid "items" array')
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
      // Log full error details for debugging
      console.error(`Error detecting clothing items (attempt ${attempt + 1}/${maxRetries + 1}):`, error)
      if (error && typeof error === 'object') {
        console.error('Error details:', {
          message: (error as any).message,
          status: (error as any).status,
          statusCode: (error as any).statusCode,
          code: (error as any).code,
          response: (error as any).response,
          error: (error as any).error,
        })
      }
      lastError = error instanceof Error ? error : new Error(String(error))

      // Check if this is a rate limit error that we should retry
      const errorAny = error as any
      const isRateLimitError =
        (error instanceof Error &&
          (error.message.includes('rate limit') ||
            error.message.includes('429') ||
            error.message.toLowerCase().includes('too many requests') ||
            error.message.includes('RESOURCE_EXHAUSTED') ||
            error.message.includes('quota'))) ||
        errorAny?.status === 429 ||
        errorAny?.response?.status === 429 ||
        errorAny?.statusCode === 429 ||
        errorAny?.code === 429 ||
        errorAny?.error?.code === 'RESOURCE_EXHAUSTED'

      // If it's a rate limit error and we have retries left, wait and retry
      if (isRateLimitError && attempt < maxRetries) {
        const waitTime = Math.pow(2, attempt) * 1000 // Exponential backoff: 1s, 2s, 4s
        console.log(`Rate limit hit. Retrying in ${waitTime}ms...`)
        await sleep(waitTime)
        continue // Retry the request
      }

      // If it's not a rate limit error, or we've exhausted retries, handle the error
      // Preserve original Gemini error message for debugging
      if (error instanceof Error) {
        // Check for API key errors
        if (error.message.includes('API key') || error.message.includes('authentication') || error.message.includes('API_KEY_INVALID')) {
          throw new Error(`Gemini API authentication failed. Please check that GEMINI_API_KEY is set correctly in your .env.local file. Original error: ${error.message}`)
        }

        // Check for rate limit errors (after retries exhausted)
        if (isRateLimitError) {
          throw new Error(`Gemini API rate limit exceeded. Please wait a few minutes and try again. If this persists, you may need to upgrade your Gemini API plan. Original error: ${error.message}`)
        }

        // Check for invalid image URL errors
        if (error.message.includes('image') && (error.message.includes('invalid') || error.message.includes('not found'))) {
          throw new Error(`Failed to access image at URL: ${imageUrl.substring(0, 100)}... The image may not be publicly accessible or the URL may be invalid. Original error: ${error.message}`)
        }

        // Re-throw with original message if it's already descriptive
        if (error.message.includes('Failed to detect clothing items')) {
          throw error
        }
        throw new Error(`Failed to detect clothing items in image: ${error.message}`)
      }

      // For non-Error objects, include the string representation
      const errorStr = error instanceof Error ? error.message : String(error)
      throw new Error(`Failed to detect clothing items in image: ${errorStr}`)
    }
  }

  // If we've exhausted all retries, throw the last error
  if (lastError) {
    if (lastError.message.includes('rate limit') || lastError.message.includes('429') || lastError.message.includes('RESOURCE_EXHAUSTED')) {
      throw new Error(`Gemini API rate limit exceeded after ${maxRetries + 1} attempts. Please wait a few minutes and try again. If this persists, you may need to upgrade your Gemini API plan. Original error: ${lastError.message}`)
    }
    throw lastError
  }

  throw new Error('Failed to detect clothing items: Unknown error occurred')
}

/**
 * Fetches an image from a URL and converts it to base64
 */
async function fetchImageAsBase64(imageUrl: string): Promise<string> {
  try {
    const response = await fetch(imageUrl)
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.statusText}`)
    }
    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    return buffer.toString('base64')
  } catch (error) {
    throw new Error(`Failed to fetch image for Gemini: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

