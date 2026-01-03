#!/bin/bash

# Script to apply Supabase migrations
# Usage:
#   ./scripts/apply-migrations.sh                    # Apply to linked remote project
#   ./scripts/apply-migrations.sh --local           # Apply to local Supabase (requires Docker)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_DIR"

if [ "$1" = "--local" ]; then
  echo "🚀 Applying migrations to local Supabase instance..."
  
  # Check if Supabase is running locally
  if ! supabase status > /dev/null 2>&1; then
    echo "❌ Local Supabase is not running. Starting it now..."
    supabase start
  fi
  
  # Apply migrations
  supabase db reset
  echo "✅ Migrations applied to local Supabase"
else
  echo "🚀 Applying migrations to remote Supabase project..."
  
  # Check if project is linked
  if [ ! -f "supabase/.temp/project-ref" ]; then
    echo "❌ Supabase project is not linked."
    echo "Please run: supabase link --project-ref <your-project-ref>"
    exit 1
  fi
  
  # Push migrations
  supabase db push
  echo "✅ Migrations applied to remote Supabase project"
fi

