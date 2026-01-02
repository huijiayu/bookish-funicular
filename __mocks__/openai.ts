import { vi } from 'vitest'

export const createMockOpenAIClient = () => {
  return {
    chat: {
      completions: {
        create: vi.fn(),
      },
    },
    embeddings: {
      create: vi.fn(),
    },
  }
}

// Default mock implementation
const mockClient = createMockOpenAIClient()

// Mock OpenAI default export
const OpenAI = vi.fn(() => mockClient)

export default OpenAI

