import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ImageUploader } from './components/upload/ImageUploader'
import { StylistSuggestion } from './components/stylist/StylistSuggestion'

export default async function HomePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

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
          <ImageUploader userId={user.id} />
        </div>

        <div className="space-y-4">
          <h2 className="text-2xl font-semibold">AI Stylist</h2>
          <StylistSuggestion userId={user.id} />
        </div>
      </div>
    </div>
  )
}

