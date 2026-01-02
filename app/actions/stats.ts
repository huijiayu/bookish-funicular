'use server'

import { createClient } from '@/lib/supabase/server'

export interface CostPerWearItem {
  id: string
  price: number
  initial_wears: number
  wear_count: number
  cost_per_wear: number
}

export interface WardrobeStats {
  costPerWear: CostPerWearItem[]
  wardrobeDiversity: number
  mostWornVibe: {
    tag: string
    wear_count: number
  } | null
}

/**
 * Calculates Cost Per Wear for all clothing items
 */
export async function getCostPerWear(userId: string): Promise<CostPerWearItem[]> {
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('get_cost_per_wear', {
    user_id_param: userId,
  })

  if (error) {
    // Fallback to direct query if RPC doesn't exist
    const { data: queryData, error: queryError } = await supabase
      .from('clothing_items')
      .select(`
        id,
        price,
        initial_wears,
        wear_events (id)
      `)
      .eq('user_id', userId)

    if (queryError) {
      console.error('Error fetching cost per wear:', queryError)
      return []
    }

    return (queryData || []).map((item: any) => {
      const wearCount = Array.isArray(item.wear_events) ? item.wear_events.length : 0
      const totalWears = item.initial_wears + wearCount
      const costPerWear = totalWears > 0 ? Number(item.price) / totalWears : Number(item.price)

      return {
        id: item.id,
        price: Number(item.price) || 0,
        initial_wears: item.initial_wears || 0,
        wear_count: wearCount,
        cost_per_wear: costPerWear,
      }
    })
  }

  return data || []
}

/**
 * Calculates Wardrobe Diversity (percentage of closet used in last 30 days)
 */
export async function getWardrobeDiversity(userId: string): Promise<number> {
  const supabase = await createClient()

  // Get recent wears (last 30 days)
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const { data: recentWears, error: wearsError } = await supabase
    .from('wear_events')
    .select('clothing_item_id')
    .eq('user_id', userId)
    .gte('worn_at', thirtyDaysAgo.toISOString())

  if (wearsError) {
    console.error('Error fetching recent wears:', wearsError)
    return 0
  }

  // Get total items
  const { data: totalItems, error: itemsError } = await supabase
    .from('clothing_items')
    .select('id', { count: 'exact', head: false })
    .eq('user_id', userId)

  if (itemsError) {
    console.error('Error fetching total items:', itemsError)
    return 0
  }

  const uniqueItemsWorn = new Set(recentWears?.map((w: any) => w.clothing_item_id) || []).size
  const totalItemsCount = totalItems?.length || 0

  if (totalItemsCount === 0) return 0

  return (uniqueItemsWorn / totalItemsCount) * 100
}

/**
 * Gets the most worn vibe tag from the last 30 days
 */
export async function getMostWornVibe(userId: string): Promise<{
  tag: string
  wear_count: number
} | null> {
  const supabase = await createClient()

  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  // Get all wear events with their clothing items' metadata
  const { data: wearEvents, error: wearsError } = await supabase
    .from('wear_events')
    .select(`
      id,
      clothing_items!inner (
        ai_metadata
      )
    `)
    .eq('user_id', userId)
    .gte('worn_at', thirtyDaysAgo.toISOString())

  if (wearsError || !wearEvents) {
    console.error('Error fetching wear events:', wearsError)
    return null
  }

  // Count vibe tags
  const tagCounts: Record<string, number> = {}

  wearEvents.forEach((event: any) => {
    const metadata = event.clothing_items?.ai_metadata
    const vibeTags = metadata?.vibe_tags || []

    if (Array.isArray(vibeTags)) {
      vibeTags.forEach((tag: string) => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1
      })
    }
  })

  // Find most worn tag
  let maxCount = 0
  let mostWornTag: string | null = null

  Object.entries(tagCounts).forEach(([tag, count]) => {
    if (count > maxCount) {
      maxCount = count
      mostWornTag = tag
    }
  })

  if (!mostWornTag) return null

  return {
    tag: mostWornTag,
    wear_count: maxCount,
  }
}

/**
 * Gets all wardrobe statistics
 */
export async function getWardrobeStats(userId: string): Promise<WardrobeStats> {
  const [costPerWear, wardrobeDiversity, mostWornVibe] = await Promise.all([
    getCostPerWear(userId),
    getWardrobeDiversity(userId),
    getMostWornVibe(userId),
  ])

  return {
    costPerWear,
    wardrobeDiversity,
    mostWornVibe,
  }
}

