import sharp from 'sharp'

export interface BoundingBox {
  x: number // Percentage (0-100)
  y: number // Percentage (0-100)
  width: number // Percentage (0-100)
  height: number // Percentage (0-100)
}

/**
 * Generates a perceptual hash for an image to detect exact duplicates
 * Uses sharp to convert to grayscale, resize to 8x8, and generate hash
 * If boundingBox is provided, crops the image to that region first
 */

// TODO: make the bounding box required
export async function generatePerceptualHash(
  imageUrl: string,
  boundingBox?: BoundingBox
): Promise<string> {
  try {
    // Fetch the image
    const response = await fetch(imageUrl)
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.statusText}`)
    }
    
    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Get image metadata to calculate pixel coordinates from percentages
    const metadata = await sharp(buffer).metadata()
    const imageWidth = metadata.width || 1
    const imageHeight = metadata.height || 1

    let imageProcessor = sharp(buffer)

    // If bounding box is provided, crop the image to that region
    if (boundingBox) {
      const left = Math.round((boundingBox.x / 100) * imageWidth)
      const top = Math.round((boundingBox.y / 100) * imageHeight)
      const width = Math.round((boundingBox.width / 100) * imageWidth)
      const height = Math.round((boundingBox.height / 100) * imageHeight)

      // Ensure coordinates are within image bounds
      const safeLeft = Math.max(0, Math.min(left, imageWidth - 1))
      const safeTop = Math.max(0, Math.min(top, imageHeight - 1))
      const safeWidth = Math.max(1, Math.min(width, imageWidth - safeLeft))
      const safeHeight = Math.max(1, Math.min(height, imageHeight - safeTop))

      imageProcessor = imageProcessor.extract({
        left: safeLeft,
        top: safeTop,
        width: safeWidth,
        height: safeHeight,
      })
    }

    // Process image: convert to grayscale, resize to 8x8
    const processed = await imageProcessor
      .greyscale()
      .resize(8, 8, { fit: 'fill' })
      .raw()
      .toBuffer()

    // Calculate average pixel value
    let sum = 0
    for (let i = 0; i < processed.length; i++) {
      sum += processed[i]
    }
    const avg = sum / processed.length

    // Generate hash: 1 if pixel > avg, 0 otherwise
    let hash = ''
    for (let i = 0; i < processed.length; i++) {
      hash += processed[i] > avg ? '1' : '0'
    }

    // Convert binary hash to hexadecimal for storage
    return hash
  } catch (error) {
    console.error('Error generating perceptual hash:', error)
    throw new Error('Failed to generate perceptual hash')
  }
}

/**
 * Calculates Hamming distance between two perceptual hashes
 * Returns the number of differing bits
 */
export function hammingDistance(hash1: string, hash2: string): number {
  if (hash1.length !== hash2.length) {
    throw new Error('Hashes must be of equal length')
  }
  
  let distance = 0
  for (let i = 0; i < hash1.length; i++) {
    if (hash1[i] !== hash2[i]) {
      distance++
    }
  }
  return distance
}

