import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getCurrentWeather } from '../../weather/openweather'

// Mock fetch
global.fetch = vi.fn()

describe('getCurrentWeather', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Clear the cache by re-importing the module
    vi.resetModules()
  })

  it('fetches from API when not cached', async () => {
    const location = 'New York'
    const mockWeatherData = {
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

    ;(global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => mockWeatherData,
    })

    const result = await getCurrentWeather(location)

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining(`q=${encodeURIComponent(location)}`)
    )
    expect(result).toEqual({
      temperature: 72,
      condition: 'Clear',
      humidity: 65,
      windSpeed: 5,
    })
  })

  it('returns cached data when available and fresh', async () => {
    const location = 'New York'
    const mockWeatherData = {
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

    ;(global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => mockWeatherData,
    })

    // First call
    const result1 = await getCurrentWeather(location)
    // Second call should use cache
    const result2 = await getCurrentWeather(location)

    expect(global.fetch).toHaveBeenCalledTimes(1)
    expect(result1).toEqual(result2)
  })

  it('refetches when cache expired', async () => {
    const location = 'New York'
    const mockWeatherData = {
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

    ;(global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => mockWeatherData,
    })

    // First call
    await getCurrentWeather(location)

    // Mock time passing (cache duration is 1 hour)
    vi.useFakeTimers()
    vi.advanceTimersByTime(2 * 60 * 60 * 1000) // 2 hours

    // Second call should refetch
    await getCurrentWeather(location)

    expect(global.fetch).toHaveBeenCalledTimes(2)

    vi.useRealTimers()
  })

  it('formats weather data correctly', async () => {
    const location = 'New York'
    const mockWeatherData = {
      main: {
        temp: 75.5,
        humidity: 70,
      },
      weather: [
        {
          main: 'Clouds',
        },
      ],
      wind: {
        speed: 10.2,
      },
    }

    ;(global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => mockWeatherData,
    })

    const result = await getCurrentWeather(location)

    expect(result.temperature).toBe(76) // Rounded
    expect(result.condition).toBe('Clouds')
    expect(result.humidity).toBe(70)
    expect(result.windSpeed).toBe(10.2)
  })

  it('throws error when API key missing', async () => {
    const originalKey = process.env.OPENWEATHER_API_KEY
    delete process.env.OPENWEATHER_API_KEY

    // Re-import to get fresh module
    const { getCurrentWeather: getWeather } = await import('../../weather/openweather')

    await expect(getWeather('New York')).rejects.toThrow('OPENWEATHER_API_KEY is not set')

    process.env.OPENWEATHER_API_KEY = originalKey
  })

  it('handles API errors', async () => {
    const location = 'New York'
    // Clear cache first
    vi.resetModules()
    const { getCurrentWeather: getWeather } = await import('../../weather/openweather')

    ;(global.fetch as any).mockResolvedValue({
      ok: false,
      statusText: 'Unauthorized',
    })

    await expect(getWeather(location)).rejects.toThrow('Failed to fetch weather data')
  })

  it('handles missing wind data', async () => {
    const location = 'New York'
    // Clear cache first
    vi.resetModules()
    const { getCurrentWeather: getWeather } = await import('../../weather/openweather')
    
    const mockWeatherData = {
      main: {
        temp: 72,
        humidity: 65,
      },
      weather: [
        {
          main: 'Clear',
        },
      ],
      // No wind property
    }

    ;(global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => mockWeatherData,
    })

    const result = await getWeather(location)

    expect(result.windSpeed).toBe(0)
  })
})

