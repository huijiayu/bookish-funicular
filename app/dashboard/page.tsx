import { getWardrobeStats } from '@/app/actions/stats'
import { StatsCard } from '@/app/components/dashboard/StatsCard'
import { FIXED_USER_ID } from '@/lib/utils/user'

export default async function DashboardPage() {
  const stats = await getWardrobeStats(FIXED_USER_ID)

  // Calculate average cost per wear
  const avgCostPerWear =
    stats.costPerWear.length > 0
      ? stats.costPerWear.reduce((sum, item) => sum + item.cost_per_wear, 0) /
        stats.costPerWear.length
      : 0

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Overview of your wardrobe statistics
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatsCard
          title="Average Cost Per Wear"
          value={`$${avgCostPerWear.toFixed(2)}`}
          description={`Based on ${stats.costPerWear.length} items`}
        />
        <StatsCard
          title="Wardrobe Diversity"
          value={`${stats.wardrobeDiversity.toFixed(1)}%`}
          description="Items worn in the last 30 days"
        />
        <StatsCard
          title="Most Worn Vibe"
          value={stats.mostWornVibe?.tag || 'N/A'}
          description={
            stats.mostWornVibe
              ? `${stats.mostWornVibe.wear_count} times in last 30 days`
              : 'No data available'
          }
        />
      </div>
    </div>
  )
}

