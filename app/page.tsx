import { ImageUploader } from './components/upload/ImageUploader'
import { StylistSuggestion } from './components/stylist/StylistSuggestion'
import { FIXED_USER_ID } from '@/lib/utils/user'

export default async function HomePage() {
  return (
    <div className="container mx-auto py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Loom & Logic</h1>
        <p className="text-muted-foreground mt-2">
          Your AI-powered wardrobe assistant
        </p>
      </div>

      <div className="grid gap-8 md:grid-cols-2">
        <div className="space-y-4">
          <h2 className="text-2xl font-semibold">Upload Clothing</h2>
          <ImageUploader userId={FIXED_USER_ID} />
        </div>

        <div className="space-y-4">
          <h2 className="text-2xl font-semibold">AI Stylist</h2>
          <StylistSuggestion userId={FIXED_USER_ID} />
        </div>
      </div>
    </div>
  )
}


