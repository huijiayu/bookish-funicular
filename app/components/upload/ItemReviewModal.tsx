'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { processClothingItems, type ProcessItemInput } from '@/app/actions/process-image'
import type { DetectedItem } from '@/lib/gemini/multi-item-detection'
import { X, Check } from 'lucide-react'

interface ItemReviewModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  imageUrl: string
  detectedItems: DetectedItem[]
  userId: string
  onSuccess: () => void
}

export function ItemReviewModal({
  open,
  onOpenChange,
  imageUrl,
  detectedItems,
  userId,
  onSuccess,
}: ItemReviewModalProps) {
  const [selectedItems, setSelectedItems] = useState<Set<number>>(
    new Set(detectedItems.map((_, i) => i))
  )
  const [processing, setProcessing] = useState(false)
  const [editingItem, setEditingItem] = useState<number | null>(null)
  const [editedItems, setEditedItems] = useState<DetectedItem[]>(detectedItems)

  const toggleItem = (index: number) => {
    const newSelected = new Set(selectedItems)
    if (newSelected.has(index)) {
      newSelected.delete(index)
    } else {
      newSelected.add(index)
    }
    setSelectedItems(newSelected)
  }

  const handleProcess = async () => {
    if (selectedItems.size === 0) {
      toast.error('Please select at least one item to process')
      return
    }

    setProcessing(true)
    try {
      const itemsToProcess: ProcessItemInput[] = Array.from(selectedItems).map(
        (index) => ({
          imageUrl,
          description: editedItems[index].description,
          category: editedItems[index].category,
          boundingBox: editedItems[index].bounding_box, // Pass bounding box for perceptual hash
        })
      )

      const results = await processClothingItems(userId, itemsToProcess)
      
      const mergedCount = results.filter((r) => r.merged).length
      const newCount = results.filter((r) => !r.merged).length

      if (mergedCount > 0) {
        toast.success(
          `${newCount} new item(s) added, ${mergedCount} merged with existing items`
        )
      } else {
        toast.success(`${newCount} item(s) added to your closet`)
      }

      onSuccess()
      onOpenChange(false)
    } catch (error) {
      console.error('Error processing items:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      
      if (errorMessage.includes('Supabase') || errorMessage.includes('database')) {
        toast.error('Database error. Please check your Supabase configuration.', {
          duration: 5000,
        })
      } else if (errorMessage.includes('Gemini') || errorMessage.includes('API')) {
        toast.error('AI processing error. Please check your Gemini API configuration.', {
          duration: 5000,
        })
      } else if (errorMessage.includes('perceptual hash') || errorMessage.includes('image')) {
        toast.error('Image processing error. Please try a different image.', {
          duration: 5000,
        })
      } else {
        toast.error(`Failed to process items: ${errorMessage}`, {
          duration: 5000,
        })
      }
    } finally {
      setProcessing(false)
    }
  }

  const updateItem = (index: number, field: keyof DetectedItem, value: string) => {
    const updated = [...editedItems]
    updated[index] = { ...updated[index], [field]: value }
    setEditedItems(updated)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Review Detected Items</DialogTitle>
          <DialogDescription>
            Review and edit the detected clothing items before adding them to your closet.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Image Preview */}
          <div className="relative w-full h-64 rounded-lg overflow-hidden border">
            <img
              src={imageUrl}
              alt="Uploaded image"
              className="w-full h-full object-contain"
            />
          </div>

          {/* Detected Items List */}
          <div className="space-y-3">
            {editedItems.map((item, index) => (
              <Card
                key={index}
                className={`cursor-pointer transition-colors ${
                  selectedItems.has(index)
                    ? 'border-primary bg-primary/5'
                    : 'border-muted'
                }`}
                onClick={() => toggleItem(index)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0">
                      <div className="w-16 h-16 rounded border bg-muted flex items-center justify-center">
                        {selectedItems.has(index) ? (
                          <Check className="w-6 h-6 text-primary" />
                        ) : (
                          <div className="w-6 h-6 border-2 border-muted-foreground rounded" />
                        )}
                      </div>
                    </div>
                    <div className="flex-1 space-y-2">
                      {editingItem === index ? (
                        <div className="space-y-2">
                          <input
                            type="text"
                            value={item.category}
                            onChange={(e) =>
                              updateItem(index, 'category', e.target.value)
                            }
                            className="w-full px-2 py-1 border rounded text-sm"
                            placeholder="Category"
                            onClick={(e) => e.stopPropagation()}
                          />
                          <textarea
                            value={item.description}
                            onChange={(e) =>
                              updateItem(index, 'description', e.target.value)
                            }
                            className="w-full px-2 py-1 border rounded text-sm"
                            placeholder="Description"
                            rows={2}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation()
                              setEditingItem(null)
                            }}
                          >
                            Save
                          </Button>
                        </div>
                      ) : (
                        <div>
                          <div className="font-medium">{item.category}</div>
                          <div className="text-sm text-muted-foreground">
                            {item.description}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            Confidence: {(item.confidence * 100).toFixed(0)}%
                          </div>
                        </div>
                      )}
                    </div>
                    {editingItem !== index && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation()
                          setEditingItem(index)
                        }}
                      >
                        Edit
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={processing}
            >
              Cancel
            </Button>
            <Button onClick={handleProcess} disabled={processing}>
              {processing ? 'Processing...' : `Process ${selectedItems.size} Selected`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

