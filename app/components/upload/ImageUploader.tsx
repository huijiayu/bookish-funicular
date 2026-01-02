'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/components/ui/toast'
import { createSignedUploadUrl, detectClothingItemsAction } from '@/app/actions/upload'
import { ItemReviewModal } from './ItemReviewModal'
import { createClient } from '@/lib/supabase/client'
import { Upload, Image as ImageIcon } from 'lucide-react'
import type { DetectedItem } from '@/lib/openai/multi-item-detection'

interface ImageUploaderProps {
  userId: string
}

export function ImageUploader({ userId }: ImageUploaderProps) {
  const [uploading, setUploading] = useState(false)
  const [detecting, setDetecting] = useState(false)
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null)
  const [detectedItems, setDetectedItems] = useState<DetectedItem[]>([])
  const [reviewModalOpen, setReviewModalOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file')
      return
    }

    setUploading(true)
    try {
      // Step 1: Get signed upload URL
      const { signedUrl, path } = await createSignedUploadUrl(userId, file.name)

      // Step 2: Upload directly to Supabase Storage
      const response = await fetch(signedUrl, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type,
        },
      })

      if (!response.ok) {
        throw new Error('Upload failed')
      }

      // Step 3: Get public URL
      const supabase = createClient()
      const {
        data: { publicUrl },
      } = supabase.storage.from('clothing-items').getPublicUrl(path)

      setUploadedImageUrl(publicUrl)

      // Step 4: Detect clothing items
      setDetecting(true)
      const items = await detectClothingItemsAction(userId, publicUrl)
      setDetectedItems(items)

      if (items.length === 0) {
        toast.warning('No clothing items detected in the image')
        setUploading(false)
        setDetecting(false)
        return
      }

      // Step 5: Open review modal
      setReviewModalOpen(true)
    } catch (error) {
      console.error('Error uploading image:', error)
      toast.error('Failed to upload image. Please try again.')
    } finally {
      setUploading(false)
      setDetecting(false)
    }
  }

  const handleUploadSuccess = () => {
    setUploadedImageUrl(null)
    setDetectedItems([])
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <>
      <div className="space-y-4">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
          id="image-upload"
        />
        <label htmlFor="image-upload">
          <Button
            variant="outline"
            className="w-full"
            disabled={uploading || detecting}
            asChild
          >
            <span>
              {uploading || detecting ? (
                <>
                  <Upload className="mr-2 h-4 w-4 animate-pulse" />
                  {uploading ? 'Uploading...' : 'Detecting items...'}
                </>
              ) : (
                <>
                  <ImageIcon className="mr-2 h-4 w-4" />
                  Upload Clothing Image
                </>
              )}
            </span>
          </Button>
        </label>

        {(uploading || detecting) && (
          <div className="space-y-2">
            <Skeleton className="w-full h-64 rounded-lg" />
            <div className="text-sm text-muted-foreground text-center">
              {uploading ? 'Uploading image...' : 'Detecting clothing items...'}
            </div>
          </div>
        )}
      </div>

      {uploadedImageUrl && detectedItems.length > 0 && (
        <ItemReviewModal
          open={reviewModalOpen}
          onOpenChange={setReviewModalOpen}
          imageUrl={uploadedImageUrl}
          detectedItems={detectedItems}
          userId={userId}
          onSuccess={handleUploadSuccess}
        />
      )}
    </>
  )
}

