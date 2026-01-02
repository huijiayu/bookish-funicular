'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/components/ui/toast'
import { getStylistSuggestion } from '@/app/actions/stylist'
import Image from 'next/image'
import { Sparkles, MapPin } from 'lucide-react'

interface StylistSuggestionProps {
  userId: string
}

export function StylistSuggestion({ userId }: StylistSuggestionProps) {
  const [intent, setIntent] = useState('')
  const [location, setLocation] = useState('')
  const [loading, setLoading] = useState(false)
  const [suggestion, setSuggestion] = useState<{
    outfit_items: string[]
    reasoning: string
    color_palette: string
    weather_appropriateness: string
    items: Array<{
      id: string
      category: string
      sub_category: string
      primary_color: string
      image_url?: string
    }>
  } | null>(null)

  const handleGetSuggestion = async () => {
    if (!intent.trim()) {
      toast.error('Please enter an occasion or intent')
      return
    }

    setLoading(true)
    try {
      const result = await getStylistSuggestion(userId, intent, location || undefined)
      setSuggestion(result)
    } catch (error) {
      console.error('Error getting stylist suggestion:', error)
      toast.error('Failed to get outfit suggestion. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            AI Stylist
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="intent" className="text-sm font-medium">
              Occasion / Intent
            </label>
            <input
              id="intent"
              type="text"
              value={intent}
              onChange={(e) => setIntent(e.target.value)}
              placeholder="e.g., Dinner date, Casual day out, Work meeting"
              className="w-full px-3 py-2 border rounded-md"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="location" className="text-sm font-medium flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Location (optional)
            </label>
            <input
              id="location"
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g., New York, NY"
              className="w-full px-3 py-2 border rounded-md"
            />
          </div>
          <Button onClick={handleGetSuggestion} disabled={loading} className="w-full">
            {loading ? 'Getting suggestion...' : 'Get Outfit Suggestion'}
          </Button>
        </CardContent>
      </Card>

      {loading && (
        <div className="space-y-4">
          <Skeleton className="w-full h-64" />
          <Skeleton className="w-full h-32" />
        </div>
      )}

      {suggestion && !loading && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Suggested Outfit</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Outfit Items */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {suggestion.items.map((item) => (
                  <div key={item.id} className="space-y-2">
                    {item.image_url ? (
                      <div className="relative w-full aspect-square rounded-lg overflow-hidden border">
                        <Image
                          src={item.image_url}
                          alt={item.sub_category}
                          fill
                          className="object-cover"
                        />
                      </div>
                    ) : (
                      <div className="w-full aspect-square rounded-lg border bg-muted flex items-center justify-center">
                        <span className="text-muted-foreground text-sm">No image</span>
                      </div>
                    )}
                    <div className="text-sm">
                      <div className="font-medium">{item.sub_category}</div>
                      <div className="text-muted-foreground">{item.primary_color}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Reasoning */}
              <div className="space-y-2 pt-4 border-t">
                <h3 className="font-semibold">Why this outfit?</h3>
                <p className="text-sm text-muted-foreground">{suggestion.reasoning}</p>
              </div>

              {/* Color Palette */}
              <div className="space-y-2">
                <h3 className="font-semibold">Color Palette</h3>
                <p className="text-sm text-muted-foreground">{suggestion.color_palette}</p>
              </div>

              {/* Weather Appropriateness */}
              {suggestion.weather_appropriateness && (
                <div className="space-y-2">
                  <h3 className="font-semibold">Weather Match</h3>
                  <p className="text-sm text-muted-foreground">
                    {suggestion.weather_appropriateness}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

