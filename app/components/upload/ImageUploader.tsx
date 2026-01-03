'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { createSignedUploadUrl, detectClothingItemsAction } from '@/app/actions/upload'
import { ItemReviewModal } from './ItemReviewModal'
import { createClient } from '@/lib/supabase/client'
import { Upload, Image as ImageIcon } from 'lucide-react'
import type { DetectedItem } from '@/lib/gemini/multi-item-detection'

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
    console.log('handleFileSelect called', event.target.files)
    const file = event.target.files?.[0]
    if (!file) {
      console.log('No file selected')
      return
    }

    console.log('File selected:', file.name, file.type, file.size)
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
        const errorText = await response.text().catch(() => 'Unknown error')
        throw new Error(`Upload to Supabase Storage failed: ${response.status} ${response.statusText}. ${errorText}`)
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
      
      // Provide more specific error messages
      // Check most specific errors first, then general ones
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      
      if (errorMessage.includes('rate limit') || errorMessage.includes('429')) {
        toast.error('Gemini API rate limit exceeded. Please wait a moment and try again.', {
          duration: 5000,
        })
      } else if (errorMessage.includes('does not exist') || errorMessage.includes('Storage bucket')) {
        toast.error(
          'Storage bucket not configured. Please ensure the database migrations have been run.',
          { duration: 5000 }
        )
      } else if (errorMessage.includes('Failed to create signed URL') || errorMessage.includes('createSignedUploadUrl')) {
        toast.error('Failed to create upload URL. Please check your Supabase configuration.', {
          duration: 5000,
        })
      } else if (errorMessage.includes('Upload to Supabase Storage failed')) {
        toast.error('Failed to upload image to storage. Please check your Supabase configuration.', {
          duration: 5000,
        })
      } else if (errorMessage.includes('GEMINI_API_KEY') || (errorMessage.includes('Gemini API') && errorMessage.includes('authentication'))) {
        toast.error('Gemini API configuration error. Please check your .env.local file.', {
          duration: 5000,
        })
      } else if (errorMessage.includes('Failed to detect clothing items')) {
        // Extract the actual error reason from the message
        const match = errorMessage.match(/Failed to detect clothing items: (.+)/)
        if (match && match[1]) {
          toast.error(`Failed to detect clothing items: ${match[1]}`, {
            duration: 5000,
          })
        } else {
          toast.error('Failed to detect clothing items in the image. Please try a different image.', {
            duration: 5000,
          })
        }
      } else if (errorMessage.includes('Gemini API')) {
        toast.error(`Gemini API error: ${errorMessage}`, {
          duration: 5000,
        })
      } else {
        toast.error(`Failed to upload image: ${errorMessage}`, {
          duration: 5000,
        })
      }
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

  const handleButtonClick = () => {
    fileInputRef.current?.click()
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
        <Button
          variant="outline"
          className="w-full"
          disabled={uploading || detecting}
          onClick={handleButtonClick}
          type="button"
        >
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
        </Button>

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

