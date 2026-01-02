import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getCurrentWeather } from '../../weather/openweather'

// Mock fetch
global.fetch = vi.fn()

describe('getCurrentWeather', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Don't reset modules - it interferes with the cache test
    // The cache will be fresh for each test since modules are isolated
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
    const location = 'Boston' // Use unique location for this test
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

    // First call - should fetch
    const result1 = await getCurrentWeather(location)
    expect(global.fetch).toHaveBeenCalledTimes(1)
    
    // Second call - should use cache (no new fetch)
    const result2 = await getCurrentWeather(location)
    expect(global.fetch).toHaveBeenCalledTimes(1) // Still 1, not 2
    expect(result1).toEqual(result2)
  })

  it('refetches when cache expired', async () => {
    const location = 'Los Angeles' // Use different location to avoid cache conflicts
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
    expect(global.fetch).toHaveBeenCalledTimes(1)

    // Manually expire cache by manipulating the cache directly
    // Since we can't easily access the cache, we'll use a different approach:
    // Wait for cache to expire (but this is slow in tests)
    // Instead, let's test that cache works within the same test
    // and test expiration separately by using a different location after time passes
    
    // Clear fetch mock to count new calls
    ;(global.fetch as any).mockClear()
    
    // Mock time passing (cache duration is 1 hour)
    vi.useFakeTimers()
    const originalDateNow = Date.now
    let currentTime = Date.now()
    global.Date.now = vi.fn(() => currentTime)
    
    // Advance time by 2 hours
    currentTime += 2 * 60 * 60 * 1000

    // Second call should refetch
    await getCurrentWeather(location)

    expect(global.fetch).toHaveBeenCalledTimes(1)

    // Restore
    global.Date.now = originalDateNow
    vi.useRealTimers()
  })

  it('formats weather data correctly', async () => {
    const location = 'Chicago' // Use different location to avoid cache conflicts
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

    expect(result.temperature).toBe(76) // Rounded from 75.5
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

