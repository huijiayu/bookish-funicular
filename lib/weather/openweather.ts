interface WeatherData {
  temperature: number
  condition: string
  humidity: number
  windSpeed: number
}

// Simple in-memory cache (in production, use Redis or similar)
const weatherCache = new Map<string, { data: WeatherData; timestamp: number }>()
const CACHE_DURATION = 1 * 60 * 60 * 1000 // 1 hour

/**
 * Fetches current weather data from OpenWeather API
 * Caches results for 1 hour to reduce API calls
 */
export async function getCurrentWeather(
  location: string
): Promise<WeatherData> {
  const apiKey = process.env.OPENWEATHER_API_KEY
  if (!apiKey) {
    throw new Error('OPENWEATHER_API_KEY is not set')
  }

  // Check cache
  const cached = weatherCache.get(location)
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data
  }

  try {
    // OpenWeather API call
    const response = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(
        location
      )}&appid=${apiKey}&units=imperial`
    )

    if (!response.ok) {
      throw new Error(`Weather API error: ${response.statusText}`)
    }

    const data = await response.json()

    const weatherData: WeatherData = {
      temperature: Math.round(data.main.temp),
      condition: data.weather[0]?.main || 'Unknown',
      humidity: data.main.humidity,
      windSpeed: data.wind?.speed || 0,
    }

    // Cache the result
    weatherCache.set(location, {
      data: weatherData,
      timestamp: Date.now(),
    })

    return weatherData
  } catch (error) {
    console.error('Error fetching weather:', error)
    throw new Error('Failed to fetch weather data')
  }
}

