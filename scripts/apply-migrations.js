#!/usr/bin/env node

/**
 * Script to apply Supabase migrations programmatically
 * Uses environment variables from .env.local
 * 
 * Usage:
 *   node scripts/apply-migrations.js
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing required environment variables:');
  console.error('   NEXT_PUBLIC_SUPABASE_URL');
  console.error('   SUPABASE_SERVICE_ROLE_KEY');
  console.error('\nPlease ensure these are set in .env.local');
  process.exit(1);
}

// Create Supabase client with service role key (bypasses RLS)
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function applyMigrations() {
  console.log('🚀 Applying Supabase migrations...\n');

  const migrationsDir = path.join(__dirname, '..', 'supabase', 'migrations');
  const migrationFiles = [
    '004_enable_pgvector.sql',
    '001_create_clothing_items.sql',
    '002_create_wear_events.sql',
    '003_setup_storage.sql',
  ];

  for (const file of migrationFiles) {
    const filePath = path.join(migrationsDir, file);
    
    if (!fs.existsSync(filePath)) {
      console.warn(`⚠️  Migration file not found: ${file}`);
      continue;
    }

    const sql = fs.readFileSync(filePath, 'utf8');
    
    console.log(`📄 Applying: ${file}`);
    
    try {
      const { error } = await supabase.rpc('exec_sql', { sql_query: sql });
      
      if (error) {
        // Try direct query execution if RPC doesn't work
        // Split SQL by semicolons and execute each statement
        const statements = sql
          .split(';')
          .map(s => s.trim())
          .filter(s => s.length > 0 && !s.startsWith('--'));

        for (const statement of statements) {
          if (statement.trim()) {
            const { error: execError } = await supabase.rpc('exec_sql', { 
              sql_query: statement + ';' 
            });
            
            if (execError && !execError.message.includes('already exists')) {
              console.error(`   ❌ Error: ${execError.message}`);
            }
          }
        }
      }
      
      console.log(`   ✅ Applied: ${file}\n`);
    } catch (err) {
      console.error(`   ❌ Error applying ${file}:`, err.message);
      console.error('   💡 You may need to apply migrations manually via Supabase Dashboard\n');
    }
  }

  console.log('✅ Migration process completed!');
  console.log('\n💡 Note: If you see errors, you may need to apply migrations manually via:');
  console.log('   1. Supabase Dashboard > SQL Editor');
  console.log('   2. Or use: supabase db push (after linking your project)');
}

// Alternative: Use the combined migration file
async function applyCombinedMigration() {
  console.log('🚀 Applying combined migration...\n');

  const combinedPath = path.join(__dirname, '..', 'supabase', 'migrations', '000_combined_migration.sql');
  
  if (!fs.existsSync(combinedPath)) {
    console.error('❌ Combined migration file not found');
    process.exit(1);
  }

  const sql = fs.readFileSync(combinedPath, 'utf8');
  
  console.log('📄 Reading combined migration file...');
  
  try {
    // Note: Supabase JS client doesn't have direct SQL execution
    // This would need to be done via the Supabase Dashboard or CLI
    console.log('⚠️  Direct SQL execution via JS client is limited.');
    console.log('💡 Please use one of these methods:');
    console.log('   1. Supabase Dashboard > SQL Editor > Run the combined migration');
    console.log('   2. Supabase CLI: supabase db push (after linking)');
    console.log('   3. Or use the apply-migrations.sh script');
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

// Check if we should use combined migration
const useCombined = process.argv.includes('--combined');

if (useCombined) {
  applyCombinedMigration();
} else {
  applyMigrations();
}

