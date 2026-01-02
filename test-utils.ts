import type { ClothingMetadata } from '@/lib/openai/vision'
import type { DetectedItem } from '@/lib/openai/multi-item-detection'
import type { ClosetItem } from '@/lib/prompts/stylist-prompt'

export const TEST_USER_ID = '00000000-0000-0000-0000-000000000000'

export const TEST_IMAGE_URL = 'https://example.com/test-image.jpg'

export const createMockClothingMetadata = (overrides?: Partial<ClothingMetadata>): ClothingMetadata => ({
  category: 'top',
  sub_category: 't-shirt',
  primary_color: 'navy blue',
  secondary_colors: ['white'],
  vibe_tags: ['casual', 'minimalist'],
  estimated_season: 'all-season',
  ...overrides,
})

export const createMockDetectedItem = (overrides?: Partial<DetectedItem>): DetectedItem => ({
  description: 'A navy blue t-shirt',
  category: 'top',
  bounding_box: {
    x: 10,
    y: 20,
    width: 30,
    height: 40,
  },
  confidence: 0.9,
  ...overrides,
})

export const createMockClosetItem = (overrides?: Partial<ClosetItem>): ClosetItem => ({
  id: 'item-1',
  category: 'top',
  sub_category: 't-shirt',
  primary_color: 'navy blue',
  secondary_colors: ['white'],
  vibe_tags: ['casual', 'minimalist'],
  estimated_season: 'all-season',
  last_worn_date: '2024-01-15',
  cost_per_wear: 25.50,
  image_url: TEST_IMAGE_URL,
  ...overrides,
})

export const createMockClothingItem = (overrides?: any) => ({
  id: 'item-1',
  user_id: TEST_USER_ID,
  image_urls: {
    primary: TEST_IMAGE_URL,
    variants: [],
  },
  perceptual_hash: '1010101010101010',
  ai_metadata: createMockClothingMetadata(),
  price: 50,
  initial_wears: 0,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  ...overrides,
})

export const createMockWearEvent = (overrides?: any) => ({
  id: 'wear-1',
  user_id: TEST_USER_ID,
  clothing_item_id: 'item-1',
  worn_at: new Date().toISOString(),
  ...overrides,
})

export const createMockWeatherData = () => ({
  temperature: 72,
  condition: 'Clear',
  humidity: 65,
  windSpeed: 5,
})

export const createMockOpenAIResponse = (content: string) => ({
  choices: [
    {
      message: {
        content,
      },
    },
  ],
})

export const createMockEmbeddingResponse = (embedding: number[]) => ({
  data: [
    {
      embedding,
    },
  ],
})


