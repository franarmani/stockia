import { useState, useEffect, useCallback } from 'react'
import {
  Cloud, Sun, CloudRain, CloudLightning, CloudSnow,
  Wind, Droplets, MapPin, RefreshCw, Search, Check,
  Compass, AlertCircle, X
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useBusinessStore } from '@/stores/businessStore'

const API_KEY = 'f4c50fc0fd3a063944006b3f0d8227e7'
const STORAGE_KEY = 'cajago_weather_city'
const DEFAULT_FALLBACK_CITY = 'Bahía Blanca, AR'

interface CurrentWeather {
  city: string
  country: string
  temp: number
  feelsLike: number
  tempMin: number
  tempMax: number
  humidity: number
  windSpeed: number
  description: string
  icon: string
  conditionId: number
}

interface ForecastItem {
  time: string
  temp: number
  icon: string
  description: string
}

export default function WeatherWidget({ className }: { className?: string }) {
  const { business, updateBusiness } = useBusinessStore()
  const [city, setCity] = useState<string>(() => {
    return (business as any)?.city || localStorage.getItem(STORAGE_KEY) || ''
  })
  const [weather, setWeather] = useState<CurrentWeather | null>(null)
  const [forecast, setForecast] = useState<ForecastItem[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [refreshing, setRefreshing] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  // City editor
  const [isEditingCity, setIsEditingCity] = useState(false)
  const [cityInput, setCityInput] = useState('')

  // Fetch weather data for a city or coordinates
  const fetchWeatherData = useCallback(async (queryParam: string, isCoords = false) => {
    try {
      setError(null)
      const baseQuery = isCoords ? queryParam : `q=${encodeURIComponent(queryParam)}`
      
      // 1. Fetch current weather
      const currentUrl = `https://api.openweathermap.org/data/2.5/weather?${baseQuery}&units=metric&lang=es&appid=${API_KEY}`
      const currentRes = await fetch(currentUrl)
      
      if (!currentRes.ok) {
        if (currentRes.status === 404) throw new Error('Ciudad no encontrada')
        throw new Error('Error al consultar el servicio meteorológico')
      }
      
      const currentData = await currentRes.json()

      const parsedWeather: CurrentWeather = {
        city: currentData.name || 'Mi Ciudad',
        country: currentData.sys?.country || '',
        temp: Math.round(currentData.main.temp),
        feelsLike: Math.round(currentData.main.feels_like),
        tempMin: Math.round(currentData.main.temp_min),
        tempMax: Math.round(currentData.main.temp_max),
        humidity: currentData.main.humidity,
        windSpeed: Math.round((currentData.wind?.speed || 0) * 3.6), // convert m/s to km/h
        description: currentData.weather?.[0]?.description || 'Despejado',
        icon: currentData.weather?.[0]?.icon || '01d',
        conditionId: currentData.weather?.[0]?.id || 800,
      }

      setWeather(parsedWeather)
      setCity(parsedWeather.city)
      localStorage.setItem(STORAGE_KEY, parsedWeather.city)

      // 2. Fetch forecast (next 4 intervals)
      try {
        const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?${baseQuery}&units=metric&lang=es&cnt=5&appid=${API_KEY}`
        const forecastRes = await fetch(forecastUrl)
        if (forecastRes.ok) {
          const forecastData = await forecastRes.json()
          const items: ForecastItem[] = (forecastData.list || []).slice(0, 4).map((f: any) => {
            const date = new Date(f.dt * 1000)
            const hours = String(date.getHours()).padStart(2, '0')
            const minutes = String(date.getMinutes()).padStart(2, '0')
            return {
              time: `${hours}:${minutes} hs`,
              temp: Math.round(f.main.temp),
              icon: f.weather?.[0]?.icon || '01d',
              description: f.weather?.[0]?.description || '',
            }
          })
          setForecast(items)
        }
      } catch {
        // Forecast is optional, don't fail widget if forecast fails
      }
    } catch (err: any) {
      setError(err.message || 'No se pudo conectar con el servicio de clima')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  // Auto-detect location via IP (No browser permissions needed, 100% silent and fast)
  const autoDetectLocation = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch('https://ipwho.is/', { signal: AbortSignal.timeout(4000) })
      if (res.ok) {
        const data = await res.json()
        if (data.city) {
          const detected = `${data.city}, ${data.country_code || 'AR'}`
          await fetchWeatherData(detected, false)
          return
        }
      }
    } catch {
      // Fallback silently if IP detection is unreachable
    }
    // Default fallback
    await fetchWeatherData(DEFAULT_FALLBACK_CITY, false)
  }, [fetchWeatherData])

  // Initial load: prioritize business city, then localStorage, then autoDetect
  useEffect(() => {
    const businessCity = (business as any)?.city
    const saved = localStorage.getItem(STORAGE_KEY)
    const targetCity = businessCity || saved
    if (targetCity) {
      fetchWeatherData(targetCity, false)
    } else {
      autoDetectLocation()
    }
  }, [fetchWeatherData, autoDetectLocation, (business as any)?.city])

  const handleRefresh = () => {
    setRefreshing(true)
    fetchWeatherData(city || (business as any)?.city || DEFAULT_FALLBACK_CITY, false)
  }

  const handleSaveCity = (e: React.FormEvent) => {
    e.preventDefault()
    if (!cityInput.trim()) return
    const newCity = cityInput.trim()
    setCity(newCity)
    setIsEditingCity(false)
    setLoading(true)
    fetchWeatherData(newCity, false)
    if (business?.id) {
      updateBusiness({ city: newCity })
    }
  }

  const handleQuickCitySelect = (selectedCity: string) => {
    setCity(selectedCity)
    setIsEditingCity(false)
    setLoading(true)
    fetchWeatherData(selectedCity, false)
    if (business?.id) {
      updateBusiness({ city: selectedCity })
    }
  }

  return (
    <div className={cn(
      'cg-card p-5 relative overflow-hidden transition-all flex flex-col justify-between',
      className
    )}>
      {/* Subtle atmospheric ambient glow */}
      <div className="absolute top-0 right-0 w-64 h-32 bg-gradient-to-bl from-sky-500/10 via-indigo-500/5 to-transparent rounded-full blur-2xl pointer-events-none" />

      {/* Header with City & Action Controls */}
      <div className="flex items-center justify-between mb-4 relative z-10">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="w-8 h-8 rounded-xl bg-sky-500/15 border border-sky-500/25 flex items-center justify-center shrink-0 text-sky-400">
            <Compass className="w-4 h-4" />
          </div>
          
          {isEditingCity ? (
            <form onSubmit={handleSaveCity} className="flex items-center gap-1.5 flex-1 max-w-xs">
              <input
                type="text"
                autoFocus
                placeholder="Ciudad (ej: Bahía Blanca, Rosario...)"
                value={cityInput}
                onChange={(e) => setCityInput(e.target.value)}
                className="h-8 px-2.5 rounded-lg bg-white/[0.06] border border-white/20 text-white text-xs focus:outline-none focus:border-sky-400 w-full"
              />
              <button
                type="submit"
                className="w-8 h-8 rounded-lg bg-sky-500 text-white flex items-center justify-center hover:bg-sky-400 transition-colors shrink-0"
                title="Guardar ciudad"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setIsEditingCity(false)}
                className="w-8 h-8 rounded-lg bg-white/[0.05] text-white/50 flex items-center justify-center hover:bg-white/10 hover:text-white transition-colors shrink-0"
                title="Cancelar"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </form>
          ) : (
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold text-foreground truncate max-w-[200px]">
                  {weather ? `${weather.city}${weather.country ? `, ${weather.country}` : ''}` : (city || DEFAULT_FALLBACK_CITY)}
                </span>
                <button
                  onClick={() => {
                    setCityInput(weather?.city || city)
                    setIsEditingCity(true)
                  }}
                  className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors"
                  title="Cambiar ciudad"
                >
                  <Search className="w-3 h-3" />
                </button>
              </div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">
                Estado del Clima
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0 ml-2">
          {/* Auto detect location button */}
          <button
            onClick={autoDetectLocation}
            className="w-8 h-8 rounded-lg bg-surface-secondary hover:bg-surface-elevated border border-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            title="Detectar automáticamente mi localidad"
          >
            <MapPin className="w-3.5 h-3.5" />
          </button>
          {/* Refresh button */}
          <button
            onClick={handleRefresh}
            disabled={refreshing || loading}
            className="w-8 h-8 rounded-lg bg-surface-secondary hover:bg-surface-elevated border border-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
            title="Actualizar datos del clima"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', (refreshing || loading) && 'animate-spin text-sky-400')} />
          </button>
        </div>
      </div>

      {/* Quick city selector chips (when editing) */}
      {isEditingCity && (
        <div className="flex flex-wrap gap-1.5 mb-3 pt-1 border-t border-border animate-fade-in">
          {['Bahía Blanca', 'Buenos Aires', 'Rosario', 'Córdoba', 'Mendoza', 'Mar del Plata'].map((quickCity) => (
            <button
              key={quickCity}
              onClick={() => handleQuickCitySelect(quickCity)}
              className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-surface-secondary hover:bg-sky-500/20 hover:text-sky-400 text-text-secondary border border-border transition-colors"
            >
              {quickCity}
            </button>
          ))}
        </div>
      )}

      {/* Main Body */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2.5">
          <RefreshCw className="w-6 h-6 animate-spin text-sky-400" />
          <p className="text-xs">Cargando reporte meteorológico...</p>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-8 text-center text-rose-400 gap-2">
          <AlertCircle className="w-7 h-7 opacity-80" />
          <p className="text-xs font-semibold">{error}</p>
          <div className="flex items-center gap-2 mt-2">
            <button
              onClick={() => {
                setCity(DEFAULT_FALLBACK_CITY)
                fetchWeatherData(DEFAULT_FALLBACK_CITY, false)
              }}
              className="text-xs px-3 py-1.5 rounded-lg bg-surface-secondary hover:bg-surface-elevated text-foreground border border-border transition-colors"
            >
              Cargar Bahía Blanca
            </button>
            <button
              onClick={autoDetectLocation}
              className="text-xs px-3 py-1.5 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-400 border border-sky-500/30 transition-colors"
            >
              Reintentar
            </button>
          </div>
        </div>
      ) : weather ? (
        <div className="flex-1 flex flex-col justify-between space-y-3.5 pt-1">
          {/* Main Temp & Condition Hero */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-surface-secondary border border-border">
            <div className="flex items-center gap-3.5">
              {/* Weather Icon (Official with fallback) */}
              <div className="relative shrink-0">
                <img
                  src={`https://openweathermap.org/img/wn/${weather.icon}@2x.png`}
                  alt={weather.description}
                  className="w-14 h-14 object-contain drop-shadow"
                  onError={(e) => {
                    ;(e.target as HTMLElement).style.display = 'none'
                  }}
                />
              </div>

              <div>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl lg:text-4xl font-extrabold text-foreground font-mono tracking-tight">
                    {weather.temp}°
                  </span>
                  <span className="text-sm font-semibold text-text-muted font-mono">C</span>
                </div>
                <p className="text-xs text-text-secondary font-medium capitalize mt-0.5">
                  {weather.description}
                </p>
              </div>
            </div>

            {/* High / Low & Sensación */}
            <div className="text-right space-y-1">
              <div className="text-[11px] font-medium text-text-secondary">
                ST: <span className="text-foreground font-semibold">{weather.feelsLike}°C</span>
              </div>
              <div className="text-[11px] text-text-muted font-mono">
                <span className="text-amber-400">↑ {weather.tempMax}°</span> · <span className="text-sky-400">↓ {weather.tempMin}°</span>
              </div>
            </div>
          </div>

          {/* Secondary Metrics Bar */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-surface-secondary border border-border">
              <Droplets className="w-4 h-4 text-sky-400 shrink-0" />
              <div>
                <span className="text-[10px] text-text-muted block leading-tight">Humedad</span>
                <span className="font-bold text-foreground font-mono">{weather.humidity}%</span>
              </div>
            </div>

            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-surface-secondary border border-border">
              <Wind className="w-4 h-4 text-indigo-400 shrink-0" />
              <div>
                <span className="text-[10px] text-text-muted block leading-tight">Viento</span>
                <span className="font-bold text-foreground font-mono">{weather.windSpeed} km/h</span>
              </div>
            </div>
          </div>

          {/* Hourly Forecast Pills */}
          {forecast.length > 0 && (
            <div className="pt-2.5 border-t border-border">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider">
                  Pronóstico Próximas Horas
                </p>
                <span className="text-[10px] text-text-muted font-medium">Intervalos de 3h</span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {forecast.map((f, idx) => (
                  <div
                    key={idx}
                    className="flex flex-col items-center py-2 px-1 rounded-xl bg-surface-secondary hover:bg-surface-elevated border border-border text-center transition-all group"
                  >
                    <span className="text-[10px] font-medium text-text-secondary leading-tight">
                      {f.time}
                    </span>
                    <img
                      src={`https://openweathermap.org/img/wn/${f.icon}.png`}
                      alt={f.description}
                      className="w-8 h-8 object-contain my-0.5 group-hover:scale-110 transition-transform"
                    />
                    <span className="text-xs font-bold text-foreground font-mono tabular-nums leading-tight">
                      {f.temp}°
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}
