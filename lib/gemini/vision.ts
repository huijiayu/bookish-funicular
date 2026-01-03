import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

export interface ClothingMetadata {
  category: string
  sub_category: string
  primary_color: string
  secondary_colors: string[]
  vibe_tags: string[]
  estimated_season: string
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

/**
 * Analyzes a clothing item image and extracts structured metadata
 * Uses Google Gemini 1.5 Flash (free tier) with vision capabilities
 */
export async function analyzeClothingImage(
  imageUrl: string,
  itemDescription?: string
): Promise<ClothingMetadata> {
  try {
    // Use gemini-2.5-flash which supports vision
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

    const prompt = itemDescription
      ? `Analyze this clothing item. Previous detection description: "${itemDescription}". Extract detailed metadata about this item.`
      : 'Analyze this clothing item and extract detailed metadata.'

    const fullPrompt = `${prompt} Provide category, sub_category (e.g., t-shirt, jeans, maxi dress), primary color, secondary colors (array), vibe tags (array of style descriptors like "casual", "formal", "vintage", "minimalist"), and estimated season (spring, summer, fall, winter, or all-season).

Return your response as a valid JSON object with this exact structure:
{
  "category": "main category",
  "sub_category": "specific sub-category",
  "primary_color": "color name",
  "secondary_colors": ["color1", "color2"],
  "vibe_tags": ["tag1", "tag2"],
  "estimated_season": "spring|summer|fall|winter|all-season"
}`

    const result = await model.generateContent([
      fullPrompt,
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

    return JSON.parse(jsonText) as ClothingMetadata
  } catch (error) {
    console.error('Error analyzing clothing image:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    throw new Error(`Failed to analyze clothing image: ${errorMessage}`)
  }
}

