
import { onBeforeUnmount, onMounted, ref } from 'vue'

const WEATHER_API = 'https://uapis.cn/api/v1/misc/weather?lang=zh&extended=true&forecast=true&hourly=true&minutely=true&indices=true'
const CACHE_KEY = 'aneko-weather-cache-v1'
const CACHE_TTL = 10 * 60 * 1000

const LIFE_INDEX_LABELS = {
  clothing: '穿衣',
  uv: '紫外线',
  car_wash: '洗车',
  drying: '晾晒',
  air_conditioner: '空调',
  cold_risk: '感冒',
  exercise: '运动',
  comfort: '舒适度',
  travel: '出行',
  fishing: '钓鱼',
  allergy: '过敏',
  sunscreen: '防晒',
  mood: '心情',
  beer: '啤酒',
  umbrella: '雨伞',
  traffic: '交通',
  air_purifier: '空气净化器',
  pollen: '花粉',
}

function numberOrNull(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function textOrEmpty(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeForecast(items) {
  if (!Array.isArray(items)) return []

  return items.slice(0, 7).map((item) => ({
    date: textOrEmpty(item.date),
    week: textOrEmpty(item.week),
    tempMax: numberOrNull(item.temp_max),
    tempMin: numberOrNull(item.temp_min),
    weatherDay: textOrEmpty(item.weather_day),
    weatherNight: textOrEmpty(item.weather_night),
    windDirectionDay: textOrEmpty(item.wind_dir_day),
    windDirectionNight: textOrEmpty(item.wind_dir_night),
    windScaleDay: textOrEmpty(item.wind_scale_day),
    windScaleNight: textOrEmpty(item.wind_scale_night),
    humidity: numberOrNull(item.humidity),
    precipitation: numberOrNull(item.precip),
    precipitationProbability: numberOrNull(item.pop),
    cloud: numberOrNull(item.cloud),
    uvIndex: numberOrNull(item.uv_index),
    sunrise: textOrEmpty(item.sunrise),
    sunset: textOrEmpty(item.sunset),
  }))
}

function normalizeHourly(items) {
  if (!Array.isArray(items)) return []

  return items.slice(0, 24).map((item) => ({
    time: textOrEmpty(item.time),
    temperature: numberOrNull(item.temperature),
    condition: textOrEmpty(item.weather),
    windDirection: textOrEmpty(item.wind_direction),
    windSpeed: numberOrNull(item.wind_speed),
    windScale: textOrEmpty(item.wind_scale),
    humidity: numberOrNull(item.humidity),
    precipitation: numberOrNull(item.precip),
    precipitationProbability: numberOrNull(item.pop),
    feelsLike: numberOrNull(item.feels_like),
    visibility: numberOrNull(item.visibility),
  }))
}

function normalizeMinutely(data) {
  if (!data || typeof data !== 'object') return null

  return {
    summary: textOrEmpty(data.summary),
    updateTime: textOrEmpty(data.update_time),
    data: Array.isArray(data.data)
      ? data.data.slice(0, 60).map((item) => ({
          time: textOrEmpty(item.time),
          precipitation: numberOrNull(item.precip) || 0,
          type: textOrEmpty(item.type),
        }))
      : [],
  }
}

function normalizeLifeIndices(data) {
  if (!data || typeof data !== 'object') return []

  return Object.entries(LIFE_INDEX_LABELS).flatMap(([key, name]) => {
    const item = data[key]
    if (!item || typeof item !== 'object') return []

    return [{
      key,
      name,
      level: textOrEmpty(item.level),
      brief: textOrEmpty(item.brief),
      advice: textOrEmpty(item.advice),
    }]
  })
}

function normalizeAlerts(items) {
  if (!Array.isArray(items)) return []

  return items.map((item, index) => ({
    id: `${textOrEmpty(item.type) || 'alert'}-${textOrEmpty(item.publish_time) || index}`,
    title: textOrEmpty(item.title),
    type: textOrEmpty(item.type),
    level: textOrEmpty(item.level),
    text: textOrEmpty(item.text),
    publishTime: textOrEmpty(item.publish_time),
    publisher: textOrEmpty(item.publisher),
    guidance: Array.isArray(item.guidance) ? item.guidance.map(textOrEmpty).filter(Boolean) : [],
  }))
}

function normalizeWeather(data) {
  const temperature = Number(data?.temperature)
  const condition = typeof data?.weather === 'string' ? data.weather.trim() : ''
  const city = typeof data?.city === 'string' ? data.city.trim() : ''
  const district = typeof data?.district === 'string' ? data.district.trim() : ''
  const province = typeof data?.province === 'string' ? data.province.trim() : ''

  if (!Number.isFinite(temperature) || !condition || (!city && !district && !province)) {
    throw new Error('天气数据格式无效')
  }

  return {
    temperature,
    condition,
    iconCode: String(data.weather_code || data.weather_icon || ''),
    city: city || district || province,
    district,
    location: district || city || province,
    fullLocation: [province, city, district].filter((item, index, values) => item && values.indexOf(item) === index).join(' '),
    humidity: Number.isFinite(Number(data.humidity)) ? Number(data.humidity) : null,
    windDirection: typeof data.wind_direction === 'string' ? data.wind_direction : '',
    windPower: typeof data.wind_power === 'string' ? data.wind_power : '',
    reportTime: typeof data.report_time === 'string' ? data.report_time : '',
    tempMax: numberOrNull(data.temp_max),
    tempMin: numberOrNull(data.temp_min),
    feelsLike: numberOrNull(data.feels_like),
    visibility: numberOrNull(data.visibility),
    pressure: numberOrNull(data.pressure),
    uv: numberOrNull(data.uv),
    aqi: numberOrNull(data.aqi),
    aqiLevel: numberOrNull(data.aqi_level),
    aqiCategory: textOrEmpty(data.aqi_category),
    aqiPrimary: textOrEmpty(data.aqi_primary),
    precipitation: numberOrNull(data.precipitation),
    cloud: numberOrNull(data.cloud),
    airPollutants: {
      pm25: numberOrNull(data.air_pollutants?.pm25),
      pm10: numberOrNull(data.air_pollutants?.pm10),
      o3: numberOrNull(data.air_pollutants?.o3),
      no2: numberOrNull(data.air_pollutants?.no2),
      so2: numberOrNull(data.air_pollutants?.so2),
    },
    forecast: normalizeForecast(data.forecast),
    hourlyForecast: normalizeHourly(data.hourly_forecast),
    minutelyPrecipitation: normalizeMinutely(data.minutely_precip),
    lifeIndices: normalizeLifeIndices(data.life_indices),
    alerts: normalizeAlerts(data.alerts),
  }
}

function readCache() {
  try {
    const cached = JSON.parse(window.localStorage.getItem(CACHE_KEY) || 'null')
    if (!cached || typeof cached.cachedAt !== 'number' || !cached.data) return null
    if (!Number.isFinite(cached.data.temperature) || typeof cached.data.condition !== 'string') return null
    return cached
  } catch {
    return null
  }
}

function writeCache(data) {
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify({ cachedAt: Date.now(), data }))
  } catch {
    // Weather remains usable when storage is unavailable.
  }
}

export function useWeather() {
  const weather = ref(null)
  const status = ref('loading')
  const errorMessage = ref('')
  let controller = null

  async function refresh() {
    controller?.abort()
    const requestController = new AbortController()
    controller = requestController
    status.value = 'loading'
    errorMessage.value = ''

    try {
      const response = await fetch(WEATHER_API, {
        signal: requestController.signal,
        headers: { Accept: 'application/json' },
      })

      if (!response.ok) {
        throw new Error(`天气请求失败 (${response.status})`)
      }

      weather.value = normalizeWeather(await response.json())
      writeCache(weather.value)
      status.value = 'ready'
    } catch (error) {
      if (requestController.signal.aborted) return
      status.value = 'error'
      errorMessage.value = error instanceof Error ? error.message : '天气服务暂不可用'
    } finally {
      if (controller === requestController) controller = null
    }
  }

  onMounted(() => {
    const cached = readCache()
    if (cached) {
      weather.value = cached.data
      if (Date.now() - cached.cachedAt < CACHE_TTL) {
        status.value = 'ready'
        return
      }
    }
    refresh()
  })
  onBeforeUnmount(() => controller?.abort())

  return { weather, status, errorMessage, refresh }
}
