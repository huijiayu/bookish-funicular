import OpenAI from 'openai'
import sharp from 'sharp'
import type { BoundingBox } from '@/lib/utils/perceptual-hash'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

/**
 * Generates a vision embedding for an image using OpenAI's embedding API
 * Note: OpenAI's embedding API doesn't directly support images, so we'll use
 * the Vision API to get a description and then embed that, or use a workaround.
 * 
 * For now, we'll use the Vision API with a special prompt to get embeddings.
 * If OpenAI releases image embeddings, we'll update this.
 * 
 * If boundingBox is provided, crops the image to that region first.
 */

// TODO: make the bounding box required
export async function generateImageEmbedding(
  imageUrl: string,
  boundingBox?: BoundingBox
): Promise<number[]> {
  try {
    let imageUrlToUse = imageUrl

    // If bounding box is provided, crop the image first
    if (boundingBox) {
      const response = await fetch(imageUrl)
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.statusText}`)
      }
      
      const arrayBuffer = await response.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)

      const metadata = await sharp(buffer).metadata()
      const imageWidth = metadata.width || 1
      const imageHeight = metadata.height || 1

      const left = Math.round((boundingBox.x / 100) * imageWidth)
      const top = Math.round((boundingBox.y / 100) * imageHeight)
      const width = Math.round((boundingBox.width / 100) * imageWidth)
      const height = Math.round((boundingBox.height / 100) * imageHeight)

      const safeLeft = Math.max(0, Math.min(left, imageWidth - 1))
      const safeTop = Math.max(0, Math.min(top, imageHeight - 1))
      const safeWidth = Math.max(1, Math.min(width, imageWidth - safeLeft))
      const safeHeight = Math.max(1, Math.min(height, imageHeight - safeTop))

      // Crop and convert to buffer for base64 encoding
      const croppedBuffer = await sharp(buffer)
        .extract({
          left: safeLeft,
          top: safeTop,
          width: safeWidth,
          height: safeHeight,
        })
        .toBuffer()

      // Convert to base64 data URL for Vision API
      const base64 = croppedBuffer.toString('base64')
      imageUrlToUse = `data:image/jpeg;base64,${base64}`
    }

    // Since OpenAI's embedding API doesn't support images directly,
    // we'll use the Vision API to get a detailed description and embed that
    // Alternatively, we can use a third-party service or wait for OpenAI image embeddings
    
    // For now, we'll use a workaround: get a detailed description from Vision API
    // and embed that text description
    const visionResponse = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Provide a detailed, structured description of this clothing item including: category, colors, style, patterns, and distinctive features. Be specific and comprehensive.',
            },
            {
              type: 'image_url',
              image_url: {
                url: imageUrlToUse,
                detail: 'low',
              },
            },
          ],
        },
      ],
      max_tokens: 300,
    })

    const description = visionResponse.choices[0]?.message?.content || ''
    
    // Now embed the description
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: description,
    })

    return embeddingResponse.data[0].embedding
  } catch (error) {
    console.error('Error generating image embedding:', error)
    throw new Error('Failed to generate image embedding')
  }
}

