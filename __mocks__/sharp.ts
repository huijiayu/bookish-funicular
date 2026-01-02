import { vi } from 'vitest'

// Mock sharp image processor
const mockSharp = vi.fn(() => {
  const chain = {
    metadata: vi.fn(),
    extract: vi.fn().mockReturnThis(),
    greyscale: vi.fn().mockReturnThis(),
    resize: vi.fn().mockReturnThis(),
    raw: vi.fn().mockReturnThis(),
    toBuffer: vi.fn(),
    toFile: vi.fn(),
  }
  return chain
})

// Add static methods
mockSharp.metadata = vi.fn()

export default mockSharp


