import { vi } from 'vitest'

// Mock Supabase query builder
export const createMockQueryBuilder = () => {
  const query = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    gt: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    like: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    contains: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    single: vi.fn(),
    maybeSingle: vi.fn(),
    head: vi.fn(),
    count: vi.fn(),
  }
  return query
}

// Mock Supabase storage
export const createMockStorage = () => ({
  from: vi.fn(() => ({
    createSignedUploadUrl: vi.fn(),
    upload: vi.fn(),
    download: vi.fn(),
    remove: vi.fn(),
    list: vi.fn(),
    getPublicUrl: vi.fn(),
  })),
})

// Mock Supabase client
export const createMockSupabaseClient = () => {
  const queryBuilder = createMockQueryBuilder()
  const storage = createMockStorage()

  return {
    from: vi.fn(() => queryBuilder),
    rpc: vi.fn(),
    storage,
    auth: {
      getUser: vi.fn(),
      getSession: vi.fn(),
    },
  }
}

// Mock Supabase SSR createClient
export const createClient = vi.fn(() => createMockSupabaseClient())

// Mock Supabase SSR createServerClient
export const createServerClient = vi.fn(() => createMockSupabaseClient())

// Mock Supabase SSR createBrowserClient
export const createBrowserClient = vi.fn(() => createMockSupabaseClient())

// Mock Supabase JS createClient
export const createSupabaseClient = vi.fn(() => createMockSupabaseClient())

