# Database Migration Guide

This guide explains how to apply the Supabase database migrations to set up your database schema.

## Prerequisites

- A Supabase project (create one at https://supabase.com if you don't have one)
- Supabase CLI installed (already installed via Homebrew)
- Your Supabase project credentials

## Migration Files

The following migrations will be applied in order:

1. **004_enable_pgvector.sql** - Enables the pgvector extension for semantic similarity search
2. **001_create_clothing_items.sql** - Creates the main clothing items table with RLS policies
3. **002_create_wear_events.sql** - Creates the wear events tracking table
4. **003_setup_storage.sql** - Sets up the storage bucket and policies for image uploads

Alternatively, you can use the **000_combined_migration.sql** file which contains all migrations in the correct order.

## Method 1: Supabase CLI (Recommended)

### Step 1: Login to Supabase CLI

```bash
supabase login
```

This will open your browser to authenticate.

### Step 2: Link Your Project

```bash
supabase link --project-ref <your-project-ref>
```

You can find your project ref in your Supabase dashboard URL:
- URL format: `https://supabase.com/dashboard/project/<project-ref>`
- Or go to Project Settings > General > Reference ID

You'll be prompted for your database password (found in Project Settings > Database).

### Step 3: Apply Migrations

```bash
supabase db push
```

This will apply all migrations in the `supabase/migrations/` directory.

### Alternative: Use the Script

```bash
./scripts/apply-migrations.sh
```

## Method 2: Supabase Dashboard (Easiest)

### Step 1: Open SQL Editor

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor** in the left sidebar
3. Click **New Query**

### Step 2: Apply Combined Migration

1. Open the file: `supabase/migrations/000_combined_migration.sql`
2. Copy the entire contents
3. Paste into the SQL Editor
4. Click **Run** (or press Cmd/Ctrl + Enter)

The combined migration file includes all migrations in the correct order and is idempotent (safe to run multiple times).

### Step 3: Verify

Check that the following were created:
- ✅ `clothing_items` table
- ✅ `wear_events` table
- ✅ `clothing-items` storage bucket
- ✅ Row Level Security (RLS) policies
- ✅ pgvector extension enabled

## Method 3: Individual Migrations via Dashboard

If you prefer to apply migrations individually:

1. Apply **004_enable_pgvector.sql** first
2. Then **001_create_clothing_items.sql**
3. Then **002_create_wear_events.sql**
4. Finally **003_setup_storage.sql**

## Verification

After applying migrations, verify the setup:

```sql
-- Check tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('clothing_items', 'wear_events');

-- Check pgvector extension
SELECT * FROM pg_extension WHERE extname = 'vector';

-- Check storage bucket
SELECT * FROM storage.buckets WHERE id = 'clothing-items';
```

## Troubleshooting

### Error: "extension vector does not exist"
- Make sure migration 004 runs before 001 (pgvector must be enabled first)
- Use the combined migration file which handles this automatically

### Error: "relation already exists"
- Tables already exist - this is fine if you're re-running migrations
- The combined migration uses `IF NOT EXISTS` to handle this

### Error: "policy already exists"
- Policies already exist - the combined migration drops and recreates them
- Individual migrations may need to be adjusted if re-running

### Storage bucket errors
- Ensure you have the correct permissions
- The storage bucket creation uses `ON CONFLICT DO NOTHING` so it's safe to re-run

## Next Steps

After migrations are applied:

1. Verify your environment variables are set in `.env.local`
2. Test the application: `npm run dev`
3. Try uploading a clothing item to verify the setup

## Need Help?

- Supabase CLI Docs: https://supabase.com/docs/reference/cli
- Supabase SQL Editor: https://supabase.com/docs/guides/database/tables

