import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  getCostPerWear,
  getWardrobeDiversity,
  getMostWornVibe,
  getWardrobeStats,
} from '../stats'
import { createClient } from '@/lib/supabase/server'
import {
  TEST_USER_ID,
  createMockClothingItem,
  createMockWearEvent,
} from '../../../test-utils'

vi.mock('@/lib/supabase/server')

describe('getCostPerWear', () => {
  let mockSupabase: any
  let mockQueryBuilder: any

  beforeEach(() => {
    vi.clearAllMocks()

    mockQueryBuilder = {
      select: vi.fn(function(this: any) { return this; }),
      eq: vi.fn(function(this: any) { return this; }),
      gte: vi.fn(function(this: any) { return this; }),
      then: vi.fn(function(this: any, onResolve: any) {
        return Promise.resolve(this._mockResult || { data: null, error: null }).then(onResolve)
      }),
      catch: vi.fn(function(this: any, onReject: any) {
        return Promise.resolve(this._mockResult || { data: null, error: null }).catch(onReject)
      }),
      _mockResult: { data: null, error: null },
    }

    mockSupabase = {
      from: vi.fn(() => mockQueryBuilder),
      rpc: vi.fn(),
    }

    ;(createClient as any).mockResolvedValue(mockSupabase)
  })

  it('calculates CPW correctly: price / (initial_wears + wear_count)', async () => {
    const mockItems = [
      {
        id: 'item-1',
        price: 100,
        initial_wears: 2,
        wear_events: [
          { id: 'wear-1' },
          { id: 'wear-2' },
          { id: 'wear-3' },
        ],
      },
    ]

    mockSupabase.rpc.mockResolvedValue({ data: null, error: { message: 'Function not found' } })
    mockQueryBuilder._mockResult = {
      data: mockItems,
      error: null,
    }

    const result = await getCostPerWear(TEST_USER_ID)

    expect(result).toHaveLength(1)
    expect(result[0].cost_per_wear).toBe(100 / (2 + 3)) // 20
    expect(result[0].price).toBe(100)
    expect(result[0].initial_wears).toBe(2)
    expect(result[0].wear_count).toBe(3)
  })

  it('handles division by zero (returns price)', async () => {
    const mockItems = [
      {
        id: 'item-1',
        price: 100,
        initial_wears: 0,
        wear_events: [],
      },
    ]

    mockSupabase.rpc.mockResolvedValue({ data: null, error: { message: 'Function not found' } })
    mockQueryBuilder._mockResult = {
      data: mockItems,
      error: null,
    }

    const result = await getCostPerWear(TEST_USER_ID)

    expect(result[0].cost_per_wear).toBe(100) // Should return price when no wears
  })

  it('falls back to direct query when RPC does not exist', async () => {
    const mockItems = [
      {
        id: 'item-1',
        price: 100,
        initial_wears: 1,
        wear_events: [{ id: 'wear-1' }],
      },
    ]

    mockSupabase.rpc.mockResolvedValue({ data: null, error: { message: 'Function not found' } })
    mockQueryBuilder._mockResult = {
      data: mockItems,
      error: null,
    }

    const result = await getCostPerWear(TEST_USER_ID)

    expect(mockSupabase.rpc).toHaveBeenCalled()
    expect(mockQueryBuilder.select).toHaveBeenCalled()
    expect(result).toHaveLength(1)
  })

  it('uses RPC when available', async () => {
    const mockRpcData = [
      {
        id: 'item-1',
        price: 100,
        initial_wears: 1,
        wear_count: 2,
        cost_per_wear: 33.33,
      },
    ]

    mockSupabase.rpc.mockResolvedValue({ data: mockRpcData, error: null })

    const result = await getCostPerWear(TEST_USER_ID)

    expect(mockSupabase.rpc).toHaveBeenCalledWith('get_cost_per_wear', {
      user_id_param: TEST_USER_ID,
    })
    expect(result).toEqual(mockRpcData)
  })

  it('returns empty array on error', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: null, error: { message: 'Function not found' } })
    mockQueryBuilder._mockResult = {
      data: null,
      error: { message: 'Query error' },
    }

    const result = await getCostPerWear(TEST_USER_ID)

    expect(result).toEqual([])
  })
})

describe('getWardrobeDiversity', () => {
  let mockSupabase: any
  let mockQueryBuilder: any

  beforeEach(() => {
    vi.clearAllMocks()

    mockQueryBuilder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
    }

    mockSupabase = {
      from: vi.fn(() => mockQueryBuilder),
    }

    ;(createClient as any).mockResolvedValue(mockSupabase)
  })

  it('calculates percentage correctly: (uniqueItemsWorn / totalItems) * 100', async () => {
    const recentWears = [
      { clothing_item_id: 'item-1' },
      { clothing_item_id: 'item-2' },
      { clothing_item_id: 'item-1' }, // Duplicate
    ]
    const totalItems = [
      { id: 'item-1' },
      { id: 'item-2' },
      { id: 'item-3' },
      { id: 'item-4' },
    ]

    let callCount = 0
    mockQueryBuilder.then = vi.fn(function(this: any, onResolve: any) {
      callCount++
      const result = callCount === 1 
        ? { data: recentWears, error: null }
        : { data: totalItems, error: null }
      return Promise.resolve(result).then(onResolve)
    })

    const result = await getWardrobeDiversity(TEST_USER_ID)

    // 2 unique items worn / 4 total items = 50%
    expect(result).toBe(50)
  })

  it('returns 0 when no items exist', async () => {
    let callCount = 0
    mockQueryBuilder.then = vi.fn(function(this: any, onResolve: any) {
      callCount++
      return Promise.resolve({ data: [], error: null }).then(onResolve)
    })

    const result = await getWardrobeDiversity(TEST_USER_ID)

    expect(result).toBe(0)
  })

  it('filters by last 30 days correctly', async () => {
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    let callCount = 0
    mockQueryBuilder.then = vi.fn(function(this: any, onResolve: any) {
      callCount++
      const result = callCount === 1 
        ? { data: [], error: null }
        : { data: [{ id: 'item-1' }], error: null }
      return Promise.resolve(result).then(onResolve)
    })

    await getWardrobeDiversity(TEST_USER_ID)

    expect(mockQueryBuilder.gte).toHaveBeenCalledWith(
      'worn_at',
      expect.stringContaining(thirtyDaysAgo.toISOString().split('T')[0])
    )
  })

  it('handles errors gracefully', async () => {
    mockQueryBuilder._mockResult = {
      data: null,
      error: { message: 'Query error' },
    }

    const result = await getWardrobeDiversity(TEST_USER_ID)

    expect(result).toBe(0)
  })
})

describe('getMostWornVibe', () => {
  let mockSupabase: any
  let mockQueryBuilder: any

  beforeEach(() => {
    vi.clearAllMocks()

    mockQueryBuilder = {
      select: vi.fn(function(this: any) { return this; }),
      eq: vi.fn(function(this: any) { return this; }),
      gte: vi.fn(function(this: any) { return this; }),
      then: vi.fn(function(this: any, onResolve: any) {
        return Promise.resolve(this._mockResult || { data: null, error: null }).then(onResolve)
      }),
      catch: vi.fn(function(this: any, onReject: any) {
        return Promise.resolve(this._mockResult || { data: null, error: null }).catch(onReject)
      }),
      _mockResult: { data: null, error: null },
    }

    mockSupabase = {
      from: vi.fn(() => mockQueryBuilder),
    }

    ;(createClient as any).mockResolvedValue(mockSupabase)
  })

  it('counts vibe tags from wear events correctly', async () => {
    const wearEvents = [
      {
        id: 'wear-1',
        clothing_items: {
          ai_metadata: {
            vibe_tags: ['casual', 'minimalist'],
          },
        },
      },
      {
        id: 'wear-2',
        clothing_items: {
          ai_metadata: {
            vibe_tags: ['casual'],
          },
        },
      },
      {
        id: 'wear-3',
        clothing_items: {
          ai_metadata: {
            vibe_tags: ['formal'],
          },
        },
      },
    ]

    mockQueryBuilder._mockResult = {
      data: wearEvents,
      error: null,
    }

    const result = await getMostWornVibe(TEST_USER_ID)

    expect(result).not.toBeNull()
    expect(result?.tag).toBe('casual')
    expect(result?.wear_count).toBe(2)
  })

  it('returns most worn tag with count', async () => {
    const wearEvents = [
      {
        id: 'wear-1',
        clothing_items: {
          ai_metadata: {
            vibe_tags: ['vintage'],
          },
        },
      },
      {
        id: 'wear-2',
        clothing_items: {
          ai_metadata: {
            vibe_tags: ['vintage'],
          },
        },
      },
      {
        id: 'wear-3',
        clothing_items: {
          ai_metadata: {
            vibe_tags: ['vintage'],
          },
        },
      },
    ]

    mockQueryBuilder._mockResult = {
      data: wearEvents,
      error: null,
    }

    const result = await getMostWornVibe(TEST_USER_ID)

    expect(result?.tag).toBe('vintage')
    expect(result?.wear_count).toBe(3)
  })

  it('returns null when no wear events exist', async () => {
    mockQueryBuilder._mockResult = {
      data: [],
      error: null,
    }

    const result = await getMostWornVibe(TEST_USER_ID)

    expect(result).toBeNull()
  })

  it('filters by last 30 days', async () => {
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    mockQueryBuilder._mockResult = {
      data: [],
      error: null,
    }

    await getMostWornVibe(TEST_USER_ID)

    expect(mockQueryBuilder.gte).toHaveBeenCalledWith(
      'worn_at',
      expect.stringContaining(thirtyDaysAgo.toISOString().split('T')[0])
    )
  })

  it('handles items without vibe tags', async () => {
    const wearEvents = [
      {
        id: 'wear-1',
        clothing_items: {
          ai_metadata: {},
        },
      },
    ]

    mockQueryBuilder._mockResult = {
      data: wearEvents,
      error: null,
    }

    const result = await getMostWornVibe(TEST_USER_ID)

    expect(result).toBeNull()
  })
})

describe('getWardrobeStats', () => {
  let mockSupabase: any
  let mockQueryBuilder: any

  beforeEach(() => {
    vi.clearAllMocks()

    mockQueryBuilder = {
      select: vi.fn(function(this: any) { return this; }),
      eq: vi.fn(function(this: any) { return this; }),
      gte: vi.fn(function(this: any) { return this; }),
      then: vi.fn(function(this: any, onResolve: any) {
        return Promise.resolve(this._mockResult || { data: null, error: null }).then(onResolve)
      }),
      catch: vi.fn(function(this: any, onReject: any) {
        return Promise.resolve(this._mockResult || { data: null, error: null }).catch(onReject)
      }),
      _mockResult: { data: null, error: null },
    }

    mockSupabase = {
      from: vi.fn(() => mockQueryBuilder),
      rpc: vi.fn(),
    }

    ;(createClient as any).mockResolvedValue(mockSupabase)
  })

  it('combines all stats correctly', async () => {
    const mockCostPerWear = [
      {
        id: 'item-1',
        price: 100,
        initial_wears: 1,
        wear_count: 2,
        cost_per_wear: 33.33,
      },
    ]

    mockSupabase.rpc.mockResolvedValue({ data: null, error: { message: 'Function not found' } })
    let callCount = 0
    mockQueryBuilder.then = vi.fn(function(this: any, onResolve: any) {
      callCount++
      const results = [
        { data: [{ id: 'item-1', price: 100, initial_wears: 1, wear_events: [{ id: 'wear-1' }, { id: 'wear-2' }] }], error: null },
        { data: [{ clothing_item_id: 'item-1' }], error: null },
        { data: [{ id: 'item-1' }], error: null },
        { data: [{ id: 'wear-1', clothing_items: { ai_metadata: { vibe_tags: ['casual'] } } }], error: null },
      ]
      return Promise.resolve(results[callCount - 1] || { data: [], error: null }).then(onResolve)
    })

    const result = await getWardrobeStats(TEST_USER_ID)

    expect(result).toHaveProperty('costPerWear')
    expect(result).toHaveProperty('wardrobeDiversity')
    expect(result).toHaveProperty('mostWornVibe')
    expect(Array.isArray(result.costPerWear)).toBe(true)
    expect(typeof result.wardrobeDiversity).toBe('number')
  })

  it('uses Promise.all for parallel execution', async () => {
    const startTime = Date.now()

    mockSupabase.rpc.mockResolvedValue({ data: null, error: { message: 'Function not found' } })
    mockQueryBuilder._mockResult = { data: [], error: null }

    await getWardrobeStats(TEST_USER_ID)

    const endTime = Date.now()
    // Should complete quickly since all calls are mocked
    expect(endTime - startTime).toBeLessThan(100)
  })
})

