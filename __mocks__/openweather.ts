import { vi } from 'vitest'

// Mock fetch for OpenWeather API
export const mockFetch = vi.fn()

// Default successful weather response
export const mockWeatherResponse = {
  main: {
    temp: 72,
    humidity: 65,
  },
  weather: [
    {
      main: 'Clear',
    },
  ],
  wind: {
    speed: 5,
  },
}

