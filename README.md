# Loom & Logic

AI-powered wardrobe management system built with Next.js 15, Supabase, and Google Gemini.

## Features

- **Multi-Item Detection**: Automatically detects multiple clothing items in uploaded images
- **Hybrid Deduplication**: Uses perceptual hashing and Vision embeddings to prevent duplicates
- **AI Metadata Extraction**: Automatically tags items with category, colors, vibe tags, and season
- **Cost Per Wear Tracking**: Calculate and track the cost per wear for each item
- **Wardrobe Statistics**: Dashboard with diversity metrics and most worn vibes
- **AI Stylist**: Get outfit suggestions based on weather, occasion, and your closet

## Tech Stack

- **Next.js 15** (App Router) with TypeScript
- **Supabase** (PostgreSQL + Storage + Auth)
- **Google Gemini** (Gemini 1.5 Flash - Free Tier)
- **Tailwind CSS** + **Shadcn UI**
- **pgvector** (for semantic similarity search)

## Setup

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables in `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
GEMINI_API_KEY=your_gemini_api_key  # Get free API key at https://aistudio.google.com/app/apikey
OPENWEATHER_API_KEY=your_openweather_api_key
```

**Getting a Gemini API Key (Free):**
1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy the key and add it to `.env.local` as `GEMINI_API_KEY`
5. The free tier includes 60 requests per minute - perfect for development!

3. Run database migrations:

   **Option A: Using Supabase CLI (Recommended)**
   
   Link your project (if not already linked):
   ```bash
   supabase link --project-ref <your-project-ref>
   ```
   
   Then apply migrations:
   ```bash
   supabase db push
   ```
   
   Or use the provided script:
   ```bash
   ./scripts/apply-migrations.sh
   ```

   **Option B: Using Supabase Dashboard**
   
   1. Go to your Supabase project dashboard
   2. Navigate to SQL Editor
   3. Copy and paste the contents of `supabase/migrations/000_combined_migration.sql`
   4. Click "Run" to execute

   **Option C: Local Development (requires Docker)**
   ```bash
   supabase start
   supabase db reset
   ```

4. Run the development server:
```bash
npm run dev
```

## Project Structure

- `app/` - Next.js App Router pages and components
- `app/actions/` - Server actions for upload, processing, stats, and stylist
- `app/components/` - React components (upload, dashboard, stylist)
- `lib/` - Utility functions (Supabase client, Gemini integration, etc.)
- `supabase/migrations/` - Database migrations
- `components/ui/` - Reusable UI components (Shadcn)

## Key Features Implementation

### Multi-Item Detection
Uses Google Gemini 1.5 Flash (free tier) to detect and segment multiple clothing items in a single image before processing.

### Hybrid Deduplication
1. **Perceptual Hash**: Exact duplicate detection (same image file)
2. **Vision Embeddings**: Semantic similarity for different photos of the same item

### Image Storage
Images are stored in Supabase Storage with a JSONB structure:
```json
{
  "primary": "url1",
  "variants": ["url2", "url3"]
}
```

When duplicates are found, new images are added to the variants array.

## License

MIT

