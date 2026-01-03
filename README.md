# Loom & Logic

AI-powered wardrobe management system built with Next.js 15, Supabase, and OpenAI.

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
- **OpenAI** (GPT-4o-mini Vision API)
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
OPENAI_API_KEY=your_openai_api_key
OPENWEATHER_API_KEY=your_openweather_api_key
```

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
- `lib/` - Utility functions (Supabase client, OpenAI integration, etc.)
- `supabase/migrations/` - Database migrations
- `components/ui/` - Reusable UI components (Shadcn)

## Key Features Implementation

### Multi-Item Detection
Uses GPT-4o-mini Vision API to detect and segment multiple clothing items in a single image before processing.

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

