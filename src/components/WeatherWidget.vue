<template>
  <section
    class="weatherModule"
    :class="{ 'is-loading': isBusy, 'has-error': status === 'error' && !hasWeather }"
    :aria-busy="isBusy"
    aria-label="本地天气"
  >
    <div class="weatherTopline">
      <svg class="weatherGlobe" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="9"></circle>
        <path d="M3 12h18M12 3c2.4 2.5 3.6 5.5 3.6 9S14.4 18.5 12 21M12 3c-2.4 2.5-3.6 5.5-3.6 9s1.2 6.5 3.6 9"></path>
      </svg>

      <div class="weatherCardTools">
        <svg class="weatherIcon" viewBox="0 0 24 24" aria-hidden="true">
          <template v-if="weatherKind === 'sunny'">
            <circle cx="12" cy="12" r="4"></circle>
            <path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.65 17.65l1.42 1.42M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.65 6.35l1.42-1.42"></path>
          </template>
          <template v-else-if="weatherKind === 'rain'">
            <path d="M17.5 17H7a5 5 0 1 1 1.05-9.89A6 6 0 0 1 19 10.5c0 .17-.01.34-.03.5A3 3 0 0 1 17.5 17Z"></path>
            <path d="m8 19-1 2M13 19l-1 2M18 19l-1 2"></path>
          </template>
          <template v-else-if="weatherKind === 'thunder'">
            <path d="M17.5 16H7a5 5 0 1 1 1.05-9.89A6 6 0 0 1 19 9.5c0 .17-.01.34-.03.5A3 3 0 0 1 17.5 16Z"></path>
            <path d="m13 14-3 5h3l-1 3 4-6h-3l1-2Z"></path>
          </template>
          <template v-else-if="weatherKind === 'snow'">
            <path d="M17.5 15H7a5 5 0 1 1 1.05-9.89A6 6 0 0 1 19 8.5c0 .17-.01.34-.03.5A3 3 0 0 1 17.5 15Z"></path>
            <path d="M8 19h.01M12 21h.01M16 19h.01"></path>
          </template>
          <template v-else-if="weatherKind === 'fog'">
            <path d="M4 8h13M7 12h13M4 16h13M8 20h10"></path>
          </template>
          <template v-else>
            <path d="M17.5 18H7a5 5 0 1 1 1.05-9.89A6 6 0 0 1 19 11.5c0 .17-.01.34-.03.5A3 3 0 0 1 17.5 18Z"></path>
          </template>
        </svg>

        <button
          class="weatherDetails"
          type="button"
          :disabled="!hasWeather"
          title="查看详细天气"
          aria-label="查看详细天气"
          aria-haspopup="dialog"
          @click="openDetails"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="9"></circle>
            <path d="M12 11v5M12 8h.01"></path>
          </svg>
        </button>

        <button
          class="weatherRefresh"
          type="button"
          :disabled="isBusy"
          :title="isBusy ? '正在刷新天气' : '刷新天气'"
          :aria-label="isBusy ? '正在刷新天气' : '刷新天气'"
          @click="refresh"
        >
          <svg :class="{ 'is-spinning': isBusy }" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M20 11a8 8 0 0 0-14.9-3M4 4v5h5M4 13a8 8 0 0 0 14.9 3M20 20v-5h-5"></path>
          </svg>
        </button>
      </div>
    </div>

    <div v-if="hasWeather" class="weatherCopy" aria-live="polite">
      <p class="weatherReading">
        <span class="weatherTemperature">{{ formatTemperature(weather.temperature) }}</span>
        <span class="weatherCondition">{{ weather.condition }}</span>
      </p>
      <div class="weatherSummaryMeta" aria-label="天气摘要">
        <span v-for="item in summaryItems" :key="item">{{ item }}</span>
      </div>
      <p class="weatherLocation">{{ cardLocationText }}</p>
    </div>

    <div v-else-if="status === 'error'" class="weatherCopy weatherStateCopy" role="alert">
      <p class="weatherReading">天气暂不可用</p>
      <div class="weatherSummaryMeta"><span>点击右上角重新加载</span></div>
      <p class="weatherLocation">{{ errorMessage }}</p>
    </div>

    <div v-else class="weatherCopy weatherStateCopy" aria-live="polite">
      <p class="weatherReading"><span class="weatherTemperature">--°</span><span class="weatherCondition">正在获取</span></p>
      <div class="weatherSummaryMeta"><span>体感 --</span><span>今日 -- / --</span><span>空气 --</span></div>
      <p class="weatherLocation">正在定位当前城市</p>
    </div>
  </section>

  <Teleport v-if="isClientReady" to="body">
    <Transition name="weather-dialog">
      <div v-if="isDetailsOpen" class="weatherDialogBackdrop" @click.self="closeDetails">
        <section
          ref="dialogRef"
          class="weatherDialogPanel"
          role="dialog"
          aria-modal="true"
          aria-labelledby="weather-dialog-title"
          tabindex="-1"
          @keydown="handleDialogKeydown"
        >
          <header class="weatherDialogHeader">
            <div class="weatherDialogTitle">
              <p>{{ reportTimeText }}</p>
              <h2 id="weather-dialog-title">{{ weather.fullLocation || weather.location }}天气</h2>
            </div>

            <div class="weatherDialogCurrent" aria-label="当前天气">
              <strong>{{ formatTemperature(weather.temperature) }}</strong>
              <span>{{ weather.condition }}<small v-if="weather.feelsLike !== null">体感 {{ formatTemperature(weather.feelsLike) }}</small></span>
            </div>

            <div class="weatherDialogActions">
              <button
                type="button"
                :disabled="isBusy"
                :title="isBusy ? '正在刷新天气' : '刷新天气'"
                :aria-label="isBusy ? '正在刷新天气' : '刷新天气'"
                @click="refresh"
              >
                <svg :class="{ 'is-spinning': isBusy }" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M20 11a8 8 0 0 0-14.9-3M4 4v5h5M4 13a8 8 0 0 0 14.9 3M20 20v-5h-5"></path>
                </svg>
              </button>
              <button type="button" title="关闭天气详情" aria-label="关闭天气详情" @click="closeDetails">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="m6 6 12 12M18 6 6 18"></path>
                </svg>
              </button>
            </div>
          </header>

          <nav class="weatherTabs" role="tablist" aria-label="天气详情分类">
            <button
              v-for="(tab, index) in detailTabs"
              :id="`weather-${tab.id}-tab`"
              :key="tab.id"
              type="button"
              role="tab"
              :class="{ 'is-active': activeTab === tab.id }"
              :aria-selected="activeTab === tab.id"
              :aria-controls="`weather-${tab.id}-panel`"
              :tabindex="activeTab === tab.id ? 0 : -1"
              @click="activeTab = tab.id"
              @keydown="handleTabKeydown($event, index)"
            >
              {{ tab.label }}
            </button>
          </nav>

          <div class="weatherDialogBody">
            <p v-if="status === 'error'" class="weatherRefreshNotice" role="alert">
              刷新失败，当前仍显示上次获取的数据：{{ errorMessage }}
            </p>

            <div
              v-if="activeTab === 'overview'"
              id="weather-overview-panel"
              class="weatherTabPanel"
              role="tabpanel"
              aria-labelledby="weather-overview-tab"
            >
              <section v-if="weather.alerts.length" class="weatherDetailSection weatherAlertSection" aria-labelledby="weather-alert-title">
                <div class="weatherSectionHeading">
                  <div>
                    <p>ALERTS</p>
                    <h3 id="weather-alert-title">气象预警</h3>
                  </div>
                  <span>{{ weather.alerts.length }} 条</span>
                </div>
                <div class="weatherAlertList">
                  <details v-for="alert in weather.alerts" :key="alert.id" class="weatherAlertItem">
                    <summary>
                      <span>{{ alert.title || `${alert.type}${alert.level}预警` }}</span>
                      <small>{{ alert.publishTime }}</small>
                    </summary>
                    <p>{{ alert.text || '暂无预警详情。' }}</p>
                    <ul v-if="alert.guidance.length">
                      <li v-for="item in alert.guidance" :key="item">{{ item }}</li>
                    </ul>
                  </details>
                </div>
              </section>

              <section class="weatherDetailSection" aria-labelledby="weather-current-title">
                <div class="weatherSectionHeading">
                  <div>
                    <p>CURRENT</p>
                    <h3 id="weather-current-title">当前状况</h3>
                  </div>
                  <span v-if="weather.aqi !== null" class="weatherAqiBadge" :data-tone="aqiTone">
                    AQI {{ formatNumber(weather.aqi) }} · {{ weather.aqiCategory || '暂无评级' }}
                  </span>
                </div>
                <dl class="weatherMetricGrid">
                  <div v-for="metric in currentMetrics" :key="metric.label">
                    <dt>{{ metric.label }}</dt>
                    <dd>{{ metric.value }}</dd>
                  </div>
                </dl>
              </section>

              <section v-if="weather.minutelyPrecipitation" class="weatherDetailSection" aria-labelledby="weather-minutely-title">
                <div class="weatherSectionHeading">
                  <div>
                    <p>PRECIPITATION</p>
                    <h3 id="weather-minutely-title">分钟级降水</h3>
                  </div>
                  <span>{{ formatReportTime(weather.minutelyPrecipitation.updateTime) }}</span>
                </div>
                <p class="weatherMinutelySummary">{{ weather.minutelyPrecipitation.summary || '未来两小时暂无明确降水提示。' }}</p>
                <div v-if="minutelyBars.length" class="weatherRainChart" aria-label="未来约两小时降水趋势">
                  <span
                    v-for="bar in minutelyBars"
                    :key="`${bar.time}-${bar.index}`"
                    :style="{ '--rain-height': `${bar.height}%` }"
                    :title="`${formatHour(bar.time)}：${formatNumber(bar.precipitation, 2)} mm`"
                  ></span>
                </div>
                <div v-if="minutelyBars.length" class="weatherChartAxis" aria-hidden="true">
                  <span>现在</span><span>约 1 小时</span><span>约 2 小时</span>
                </div>
              </section>

              <section class="weatherDetailSection" aria-labelledby="weather-air-title">
                <div class="weatherSectionHeading">
                  <div>
                    <p>AIR QUALITY</p>
                    <h3 id="weather-air-title">空气污染物</h3>
                  </div>
                  <span v-if="weather.aqiPrimary">首要污染物 {{ weather.aqiPrimary }}</span>
                </div>
                <dl class="weatherPollutantGrid">
                  <div v-for="item in pollutantItems" :key="item.label">
                    <dt>{{ item.label }}</dt>
                    <dd>{{ item.value }}</dd>
                    <small>μg/m³</small>
                  </div>
                </dl>
              </section>
            </div>

            <div
              v-else-if="activeTab === 'hourly'"
              id="weather-hourly-panel"
              class="weatherTabPanel"
              role="tabpanel"
              aria-labelledby="weather-hourly-tab"
            >
              <div class="weatherSectionHeading weatherTabHeading">
                <div><p>NEXT 24 HOURS</p><h3>逐小时预报</h3></div>
                <span>{{ weather.hourlyForecast.length }} 个时段</span>
              </div>
              <div v-if="weather.hourlyForecast.length" class="weatherHourlyScroller" tabindex="0" aria-label="未来 24 小时天气">
                <article v-for="(hour, index) in weather.hourlyForecast" :key="`${hour.time}-${index}`" class="weatherHourlyItem">
                  <time :datetime="hour.time">{{ index === 0 ? '现在' : formatHour(hour.time) }}</time>
                  <strong>{{ formatTemperature(hour.temperature) }}</strong>
                  <p>{{ hour.condition || '暂无天气描述' }}</p>
                  <dl>
                    <div><dt>降水</dt><dd>{{ formatPercent(hour.precipitationProbability) }}</dd></div>
                    <div><dt>湿度</dt><dd>{{ formatPercent(hour.humidity) }}</dd></div>
                    <div><dt>风</dt><dd>{{ hour.windScale || formatSpeed(hour.windSpeed) }}</dd></div>
                  </dl>
                </article>
              </div>
              <div v-else class="weatherEmptyState">暂无逐小时预报数据</div>
            </div>

            <div
              v-else-if="activeTab === 'forecast'"
              id="weather-forecast-panel"
              class="weatherTabPanel"
              role="tabpanel"
              aria-labelledby="weather-forecast-tab"
            >
              <div class="weatherSectionHeading weatherTabHeading">
                <div><p>7 DAY OUTLOOK</p><h3>未来天气</h3></div>
                <span>{{ weather.forecast.length }} 天</span>
              </div>
              <div v-if="weather.forecast.length" class="weatherForecastList">
                <article v-for="(day, index) in weather.forecast" :key="day.date || index" class="weatherForecastItem">
                  <div class="weatherForecastDate">
                    <strong>{{ index === 0 ? '今天' : day.week || `第 ${index + 1} 天` }}</strong>
                    <time :datetime="day.date">{{ formatForecastDate(day.date) }}</time>
                  </div>
                  <div class="weatherForecastCondition">
                    <strong>{{ day.weatherDay || '暂无' }}</strong>
                    <span>夜间 {{ day.weatherNight || '暂无' }}</span>
                  </div>
                  <div class="weatherForecastTemperature">
                    <strong>{{ formatTemperature(day.tempMax) }}</strong>
                    <span>{{ formatTemperature(day.tempMin) }}</span>
                  </div>
                  <div class="weatherForecastMeta">
                    <span>降水 {{ formatPercent(day.precipitationProbability) }}</span>
                    <span>湿度 {{ formatPercent(day.humidity) }}</span>
                    <span>{{ day.windDirectionDay || '风向暂无' }} {{ day.windScaleDay }}</span>
                    <span>日出 {{ day.sunrise || '--:--' }} · 日落 {{ day.sunset || '--:--' }}</span>
                  </div>
                </article>
              </div>
              <div v-else class="weatherEmptyState">暂无多日预报数据</div>
            </div>

            <div
              v-else
              id="weather-indices-panel"
              class="weatherTabPanel"
              role="tabpanel"
              aria-labelledby="weather-indices-tab"
            >
              <div class="weatherSectionHeading weatherTabHeading">
                <div><p>DAILY GUIDANCE</p><h3>生活指数</h3></div>
                <span>{{ weather.lifeIndices.length }} 项</span>
              </div>
              <div v-if="weather.lifeIndices.length" class="weatherIndexGrid">
                <article v-for="item in weather.lifeIndices" :key="item.key" class="weatherIndexItem">
                  <header><h3>{{ item.name }}</h3><span>{{ item.level || item.brief || '今日建议' }}</span></header>
                  <p v-if="item.brief && item.brief !== item.level">{{ item.brief }}</p>
                  <p>{{ item.advice || '暂无详细建议。' }}</p>
                </article>
              </div>
              <div v-else class="weatherEmptyState">暂无生活指数数据</div>
            </div>
          </div>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useWeather } from '../composables/useWeather.js'

const { weather, status, errorMessage, refresh } = useWeather()

const detailTabs = [
  { id: 'overview', label: '概览' },
  { id: 'hourly', label: '逐小时' },
  { id: 'forecast', label: '7 日预报' },
  { id: 'indices', label: '生活指数' },
]

const activeTab = ref('overview')
const isDetailsOpen = ref(false)
const isClientReady = ref(false)
const dialogRef = ref(null)
let returnFocusElement = null
let previousBodyOverflow = null

const hasWeather = computed(() => weather.value !== null)
const isBusy = computed(() => status.value === 'loading')
const todayForecast = computed(() => weather.value?.forecast?.[0] || null)
const todayHigh = computed(() => weather.value?.tempMax ?? todayForecast.value?.tempMax ?? null)
const todayLow = computed(() => weather.value?.tempMin ?? todayForecast.value?.tempMin ?? null)

const summaryItems = computed(() => {
  if (!weather.value) return []

  const items = []
  if (weather.value.feelsLike !== null) items.push(`体感 ${formatTemperature(weather.value.feelsLike)}`)
  if (todayLow.value !== null || todayHigh.value !== null) {
    items.push(`今日 ${formatTemperature(todayLow.value)} / ${formatTemperature(todayHigh.value)}`)
  }
  if (weather.value.aqiCategory || weather.value.aqi !== null) {
    items.push(`空气 ${weather.value.aqiCategory || `AQI ${formatNumber(weather.value.aqi)}`}`)
  }

  return items
})

const cardLocationText = computed(() => {
  if (!weather.value) return ''
  const details = [weather.value.fullLocation || weather.value.location]
  if (weather.value.humidity !== null) details.push(`湿度 ${formatPercent(weather.value.humidity)}`)
  return details.filter(Boolean).join(' · ')
})

const weatherKind = computed(() => {
  const code = Number(weather.value?.iconCode)
  const condition = weather.value?.condition || ''

  if ([302, 303, 304].includes(code) || /雷/.test(condition)) return 'thunder'
  if ((code >= 300 && code < 400) || /雨/.test(condition)) return 'rain'
  if ((code >= 400 && code < 500) || /雪|冰雹/.test(condition)) return 'snow'
  if ((code >= 500 && code < 600) || /雾|霾|沙|尘/.test(condition)) return 'fog'
  if ([100, 150].includes(code) || /^晴/.test(condition)) return 'sunny'
  return 'cloudy'
})

const currentMetrics = computed(() => {
  if (!weather.value) return []
  const wind = [weather.value.windDirection, weather.value.windPower].filter(Boolean).join(' ')

  return [
    { label: '体感温度', value: formatTemperature(weather.value.feelsLike) },
    { label: '今日高 / 低', value: `${formatTemperature(todayHigh.value)} / ${formatTemperature(todayLow.value)}` },
    { label: '湿度', value: formatPercent(weather.value.humidity) },
    { label: '风向风力', value: wind || '--' },
    { label: '能见度', value: formatUnit(weather.value.visibility, 'km') },
    { label: '气压', value: formatUnit(weather.value.pressure, 'hPa') },
    { label: '紫外线', value: formatNumber(weather.value.uv) },
    { label: '云量', value: formatPercent(weather.value.cloud) },
    { label: '实时降水', value: formatUnit(weather.value.precipitation, 'mm', 2) },
    { label: '空气质量', value: weather.value.aqi === null ? '--' : `${formatNumber(weather.value.aqi)} ${weather.value.aqiCategory}`.trim() },
  ]
})

const pollutantItems = computed(() => {
  const pollutants = weather.value?.airPollutants
  if (!pollutants) return []
  return [
    { label: 'PM2.5', value: formatNumber(pollutants.pm25) },
    { label: 'PM10', value: formatNumber(pollutants.pm10) },
    { label: 'O₃', value: formatNumber(pollutants.o3) },
    { label: 'NO₂', value: formatNumber(pollutants.no2) },
    { label: 'SO₂', value: formatNumber(pollutants.so2) },
  ]
})

const minutelyBars = computed(() => {
  const items = weather.value?.minutelyPrecipitation?.data || []
  if (!items.length) return []
  const maximum = Math.max(...items.map((item) => item.precipitation), 0.1)

  return items.map((item, index) => ({
    ...item,
    index,
    height: item.precipitation > 0 ? Math.max(8, (item.precipitation / maximum) * 100) : 3,
  }))
})

const aqiTone = computed(() => {
  const aqi = weather.value?.aqi
  if (aqi === null || aqi === undefined) return 'neutral'
  if (aqi <= 50) return 'good'
  if (aqi <= 100) return 'moderate'
  if (aqi <= 150) return 'sensitive'
  return 'poor'
})

const reportTimeText = computed(() => {
  const location = weather.value?.fullLocation || weather.value?.location || '当前位置'
  const time = formatReportTime(weather.value?.reportTime)
  return time ? `${location} · ${time} 更新` : location
})

function formatNumber(value, digits = 0) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return '--'
  const number = Number(value)
  return Number.isInteger(number) ? String(number) : number.toFixed(digits || 1)
}

function formatTemperature(value) {
  return value === null || value === undefined ? '--°' : `${formatNumber(value, 1)}°`
}

function formatPercent(value) {
  return value === null || value === undefined ? '--' : `${formatNumber(value, 1)}%`
}

function formatUnit(value, unit, digits = 1) {
  return value === null || value === undefined ? '--' : `${formatNumber(value, digits)} ${unit}`
}

function formatSpeed(value) {
  return value === null || value === undefined ? '--' : `${formatNumber(value, 1)} km/h`
}

function formatHour(value) {
  if (!value) return '--:--'
  const match = String(value).match(/(?:T|\s)?(\d{1,2}:\d{2})(?::\d{2})?/)
  return match?.[1]?.padStart(5, '0') || String(value)
}

function formatReportTime(value) {
  if (!value) return ''
  const text = String(value)
  const dateMatch = text.match(/(\d{4})-(\d{2})-(\d{2})/)
  const time = formatHour(text)
  if (!dateMatch) return time === text ? text : time
  return `${Number(dateMatch[2])}月${Number(dateMatch[3])}日 ${time}`
}

function formatForecastDate(value) {
  const match = String(value || '').match(/\d{4}-(\d{2})-(\d{2})/)
  return match ? `${Number(match[1])}月${Number(match[2])}日` : value || '--'
}

async function openDetails() {
  if (!hasWeather.value) return
  returnFocusElement = document.activeElement instanceof HTMLElement ? document.activeElement : null
  previousBodyOverflow = document.body.style.overflow
  document.body.style.overflow = 'hidden'
  activeTab.value = 'overview'
  isDetailsOpen.value = true
  await nextTick()
  dialogRef.value?.focus()
}

function closeDetails() {
  if (!isDetailsOpen.value) return
  isDetailsOpen.value = false
  if (previousBodyOverflow !== null) document.body.style.overflow = previousBodyOverflow
  previousBodyOverflow = null
  nextTick(() => returnFocusElement?.focus())
}

function handleDialogKeydown(event) {
  if (event.key === 'Escape') {
    event.preventDefault()
    closeDetails()
    return
  }

  if (event.key !== 'Tab') return
  const focusable = [...dialogRef.value.querySelectorAll('button:not([disabled]), summary, [href], [tabindex]:not([tabindex="-1"])')]
    .filter((element) => element.offsetParent !== null)
  if (!focusable.length) {
    event.preventDefault()
    dialogRef.value.focus()
    return
  }

  const first = focusable[0]
  const last = focusable[focusable.length - 1]
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}

function handleTabKeydown(event, currentIndex) {
  const keys = ['ArrowLeft', 'ArrowRight', 'Home', 'End']
  if (!keys.includes(event.key)) return
  event.preventDefault()

  let targetIndex = currentIndex
  if (event.key === 'ArrowLeft') targetIndex = (currentIndex - 1 + detailTabs.length) % detailTabs.length
  if (event.key === 'ArrowRight') targetIndex = (currentIndex + 1) % detailTabs.length
  if (event.key === 'Home') targetIndex = 0
  if (event.key === 'End') targetIndex = detailTabs.length - 1

  activeTab.value = detailTabs[targetIndex].id
  event.currentTarget.closest('[role="tablist"]')?.querySelectorAll('[role="tab"]')[targetIndex]?.focus()
}

onMounted(() => {
  isClientReady.value = true
})

onBeforeUnmount(() => {
  if (previousBodyOverflow !== null) document.body.style.overflow = previousBodyOverflow
})
</script>

<style scoped>
.weatherCardTools,
.weatherReading,
.weatherSummaryMeta,
.weatherDialogHeader,
.weatherDialogCurrent,
.weatherDialogActions,
.weatherSectionHeading,
.weatherIndexItem header {
  display: flex;
  align-items: center;
}

.weatherCardTools {
  min-width: 0;
  gap: 4px;
}

.weatherCardTools .weatherIcon {
  margin-right: 2px;
}

.weatherRefresh svg,
.weatherDetails svg,
.weatherDialogActions svg {
  width: 16px;
  height: 16px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.weatherDetails {
  width: 24px;
  height: 24px;
  border: 0;
  border-radius: 6px;
  display: grid;
  place-items: center;
  color: inherit;
  background: transparent;
  cursor: pointer;
  transition: background-color 0.2s ease, transform 0.2s ease, opacity 0.2s ease;
}

.weatherDetails:hover:not(:disabled) {
  background: var(--left_tag_item);
  transform: translateY(-1px);
}

.weatherDetails:active:not(:disabled) {
  transform: scale(0.96);
}

.weatherDetails:focus-visible {
  outline: 2px solid var(--fill);
  outline-offset: 2px;
}

.weatherDetails:disabled {
  cursor: default;
  opacity: 0.28;
}

.weatherReading {
  gap: 8px;
}

.weatherTemperature {
  flex: 0 0 auto;
  font-variant-numeric: tabular-nums;
}

.weatherCondition {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.weatherSummaryMeta {
  min-width: 0;
  margin-top: 1px;
  gap: 7px;
  overflow: hidden;
  color: var(--main_text_color);
  font-size: 10px;
  line-height: 15px;
  white-space: nowrap;
  opacity: 0.78;
}

.weatherSummaryMeta span {
  min-width: 0;
  flex: 0 0 auto;
}

.weatherSummaryMeta span + span::before {
  content: "";
  display: inline-block;
  width: 2px;
  height: 2px;
  margin: 0 7px 2px 0;
  border-radius: 50%;
  background: currentColor;
  opacity: 0.65;
}

.weatherLocation {
  margin-top: 1px;
}

.weatherStateCopy .weatherSummaryMeta {
  opacity: 0.55;
}

.weatherRefresh svg.is-spinning,
.weatherDialogActions svg.is-spinning {
  animation: weatherSpin 0.8s linear infinite;
}

@keyframes weatherSpin {
  to { transform: rotate(360deg); }
}

.weatherDialogBackdrop {
  position: fixed;
  inset: 0;
  z-index: 1200;
  display: grid;
  place-items: center;
  padding: 16px;
  background: var(--weather_dialog_backdrop);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
}

.weatherDialogPanel {
  width: min(900px, calc(100vw - 32px));
  max-height: min(780px, calc(100dvh - 32px));
  border: 1px solid var(--weather_dialog_border);
  border-radius: 20px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  color: var(--weather_dialog_text);
  background: var(--weather_dialog_bg);
  box-shadow: 0 24px 70px var(--weather_dialog_shadow), inset 0 1px 0 var(--weather_dialog_inset);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  outline: none;
}

.weatherDialogHeader {
  flex: 0 0 auto;
  min-width: 0;
  padding: 22px 24px 18px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  gap: 24px;
}

.weatherDialogTitle {
  min-width: 0;
}

.weatherDialogTitle p,
.weatherSectionHeading p {
  margin: 0 0 4px;
  color: var(--weather_dialog_subtle);
  font-size: 9px;
  font-weight: 700;
  line-height: 12px;
  text-transform: uppercase;
}

.weatherDialogTitle h2 {
  margin: 0;
  overflow: hidden;
  font-size: 20px;
  font-weight: 650;
  line-height: 26px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.weatherDialogCurrent {
  align-items: baseline;
  gap: 10px;
}

.weatherDialogCurrent > strong {
  font-size: 38px;
  font-weight: 300;
  font-variant-numeric: tabular-nums;
  line-height: 42px;
}

.weatherDialogCurrent > span {
  display: flex;
  flex-direction: column;
  font-size: 13px;
  line-height: 18px;
}

.weatherDialogCurrent small {
  color: var(--weather_dialog_subtle);
  font-size: 10px;
}

.weatherDialogActions {
  align-self: start;
  gap: 6px;
}

.weatherDialogActions button {
  width: 32px;
  height: 32px;
  border: 1px solid var(--weather_dialog_line);
  border-radius: 8px;
  display: grid;
  place-items: center;
  color: inherit;
  background: var(--weather_dialog_control_bg);
  cursor: pointer;
  transition: transform 0.2s ease, background-color 0.2s ease, opacity 0.2s ease;
}

.weatherDialogActions button:hover:not(:disabled) {
  background: var(--weather_dialog_control_hover);
  transform: translateY(-1px);
}

.weatherDialogActions button:active:not(:disabled) {
  transform: scale(0.96);
}

.weatherDialogActions button:disabled {
  cursor: wait;
  opacity: 0.48;
}

.weatherDialogActions button:focus-visible,
.weatherTabs button:focus-visible,
.weatherHourlyScroller:focus-visible {
  outline: 2px solid var(--weather_dialog_focus);
  outline-offset: 2px;
}

.weatherTabs {
  min-height: 49px;
  flex: 0 0 auto;
  padding: 7px 24px;
  border-top: 1px solid var(--weather_dialog_line);
  border-bottom: 1px solid var(--weather_dialog_line);
  display: flex;
  align-items: center;
  gap: 4px;
  overflow-x: auto;
}

.weatherTabs button {
  min-width: max-content;
  height: 34px;
  padding: 0 13px;
  border: 0;
  border-radius: 8px;
  color: var(--weather_dialog_subtle);
  background: transparent;
  font: inherit;
  font-size: 12px;
  cursor: pointer;
  transition: color 0.2s ease, background-color 0.2s ease, transform 0.2s ease;
}

.weatherTabs button:hover {
  color: var(--weather_dialog_text);
  background: var(--weather_dialog_control_bg);
}

.weatherTabs button:active {
  transform: scale(0.97);
}

.weatherTabs button.is-active {
  color: var(--weather_dialog_active_text);
  background: var(--weather_dialog_active_bg);
}

.weatherDialogBody {
  min-height: 0;
  flex: 1 1 auto;
  padding: 22px 24px 28px;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.weatherRefreshNotice {
  margin: 0 0 16px;
  padding: 10px 12px;
  border-left: 2px solid var(--weather_dialog_warning_border);
  color: var(--weather_dialog_warning_text);
  background: var(--weather_dialog_warning_bg);
  font-size: 11px;
  line-height: 17px;
}

.weatherTabPanel {
  animation: weatherTabIn 0.26s cubic-bezier(0.16, 1, 0.3, 1) both;
}

@keyframes weatherTabIn {
  from { opacity: 0; transform: translate3d(0, 8px, 0); }
  to { opacity: 1; transform: translate3d(0, 0, 0); }
}

.weatherDetailSection + .weatherDetailSection {
  margin-top: 28px;
  padding-top: 24px;
  border-top: 1px solid var(--weather_dialog_line);
}

.weatherSectionHeading {
  min-width: 0;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 14px;
}

.weatherSectionHeading > div {
  min-width: 0;
}

.weatherSectionHeading h3 {
  margin: 0;
  font-size: 15px;
  font-weight: 650;
  line-height: 20px;
}

.weatherSectionHeading > span {
  flex: 0 0 auto;
  color: var(--weather_dialog_subtle);
  font-size: 10px;
  line-height: 16px;
}

.weatherAqiBadge {
  padding: 3px 8px;
  border-radius: 999px;
  color: var(--weather_aqi_good_text) !important;
  background: var(--weather_aqi_good_bg);
}

.weatherAqiBadge[data-tone="moderate"] { color: var(--weather_aqi_moderate_text) !important; background: var(--weather_aqi_moderate_bg); }
.weatherAqiBadge[data-tone="sensitive"] { color: var(--weather_aqi_sensitive_text) !important; background: var(--weather_aqi_sensitive_bg); }
.weatherAqiBadge[data-tone="poor"] { color: var(--weather_aqi_poor_text) !important; background: var(--weather_aqi_poor_bg); }
.weatherAqiBadge[data-tone="neutral"] { color: var(--weather_dialog_muted) !important; background: var(--weather_dialog_control_bg); }

.weatherMetricGrid,
.weatherPollutantGrid {
  display: grid;
  gap: 8px;
}

.weatherMetricGrid {
  grid-template-columns: repeat(5, minmax(0, 1fr));
}

.weatherMetricGrid > div,
.weatherPollutantGrid > div {
  min-width: 0;
  border: 1px solid var(--weather_dialog_line);
  border-radius: 8px;
  background: var(--weather_dialog_surface);
}

.weatherMetricGrid > div {
  min-height: 70px;
  padding: 11px 12px;
}

.weatherMetricGrid dt,
.weatherPollutantGrid dt,
.weatherHourlyItem dt {
  color: var(--weather_dialog_subtle);
  font-size: 9px;
  line-height: 13px;
}

.weatherMetricGrid dd {
  margin: 8px 0 0;
  overflow: hidden;
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  line-height: 18px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.weatherAlertList {
  display: grid;
  gap: 8px;
}

.weatherAlertItem {
  border: 1px solid var(--weather_dialog_warning_border);
  border-radius: 8px;
  background: var(--weather_dialog_warning_bg);
}

.weatherAlertItem summary {
  min-height: 44px;
  padding: 10px 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  cursor: pointer;
  list-style: none;
}

.weatherAlertItem summary::-webkit-details-marker { display: none; }

.weatherAlertItem summary::after {
  content: "+";
  flex: 0 0 auto;
  color: var(--weather_dialog_subtle);
  font-size: 17px;
  font-weight: 300;
}

.weatherAlertItem[open] summary::after { content: "−"; }

.weatherAlertItem summary span {
  min-width: 0;
  overflow: hidden;
  font-size: 12px;
  font-weight: 600;
  line-height: 17px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.weatherAlertItem summary small {
  margin-left: auto;
  color: var(--weather_dialog_subtle);
  font-size: 9px;
  white-space: nowrap;
}

.weatherAlertItem > p,
.weatherAlertItem ul {
  margin: 0 12px 12px;
  color: var(--weather_dialog_muted);
  font-size: 11px;
  line-height: 18px;
  user-select: text;
}

.weatherAlertItem ul {
  padding-left: 17px;
}

.weatherMinutelySummary {
  margin: 0 0 14px;
  color: var(--weather_dialog_muted);
  font-size: 12px;
  line-height: 18px;
}

.weatherRainChart {
  height: 62px;
  padding-top: 4px;
  border-bottom: 1px solid var(--weather_dialog_line_strong);
  display: flex;
  align-items: flex-end;
  gap: 2px;
}

.weatherRainChart span {
  height: var(--rain-height);
  min-width: 1px;
  flex: 1 1 0;
  border-radius: 2px 2px 0 0;
  background: var(--weather_dialog_rain);
}

.weatherChartAxis {
  margin-top: 6px;
  display: flex;
  justify-content: space-between;
  color: var(--weather_dialog_faint);
  font-size: 9px;
}

.weatherPollutantGrid {
  grid-template-columns: repeat(5, minmax(0, 1fr));
}

.weatherPollutantGrid > div {
  min-height: 66px;
  padding: 10px;
  display: grid;
  grid-template-columns: 1fr auto;
  align-content: center;
  column-gap: 4px;
}

.weatherPollutantGrid dd {
  grid-column: 1;
  margin: 6px 0 0;
  font-size: 14px;
  font-variant-numeric: tabular-nums;
}

.weatherPollutantGrid small {
  grid-column: 2;
  grid-row: 2;
  align-self: end;
  color: var(--weather_dialog_faint);
  font-size: 8px;
}

.weatherTabHeading {
  margin-bottom: 18px;
}

.weatherHourlyScroller {
  padding-bottom: 8px;
  display: grid;
  grid-auto-columns: 132px;
  grid-auto-flow: column;
  gap: 8px;
  overflow-x: auto;
  overscroll-behavior-inline: contain;
  scroll-snap-type: x proximity;
}

.weatherHourlyItem {
  min-height: 216px;
  padding: 14px 12px;
  border: 1px solid var(--weather_dialog_line);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  background: var(--weather_dialog_surface);
  scroll-snap-align: start;
}

.weatherHourlyItem > time {
  color: var(--weather_dialog_subtle);
  font-size: 10px;
  line-height: 14px;
}

.weatherHourlyItem > strong {
  margin-top: 13px;
  font-size: 29px;
  font-weight: 300;
  font-variant-numeric: tabular-nums;
  line-height: 34px;
}

.weatherHourlyItem > p {
  min-height: 34px;
  margin: 5px 0 12px;
  color: var(--weather_dialog_muted);
  font-size: 11px;
  line-height: 17px;
}

.weatherHourlyItem dl {
  margin-top: auto;
  display: grid;
  gap: 5px;
}

.weatherHourlyItem dl > div {
  display: flex;
  justify-content: space-between;
  gap: 6px;
}

.weatherHourlyItem dd {
  margin: 0;
  overflow: hidden;
  font-size: 9px;
  line-height: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.weatherForecastList {
  display: grid;
  gap: 1px;
  border-top: 1px solid var(--weather_dialog_line);
  border-bottom: 1px solid var(--weather_dialog_line);
}

.weatherForecastItem {
  min-width: 0;
  padding: 14px 2px;
  display: grid;
  grid-template-columns: 105px minmax(120px, 1fr) 78px minmax(250px, 1.5fr);
  align-items: center;
  gap: 14px;
}

.weatherForecastItem + .weatherForecastItem {
  border-top: 1px solid var(--weather_dialog_line);
}

.weatherForecastDate,
.weatherForecastCondition,
.weatherForecastTemperature {
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.weatherForecastDate strong,
.weatherForecastCondition strong {
  overflow: hidden;
  font-size: 12px;
  line-height: 18px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.weatherForecastDate time,
.weatherForecastCondition span {
  margin-top: 2px;
  overflow: hidden;
  color: var(--weather_dialog_subtle);
  font-size: 9px;
  line-height: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.weatherForecastTemperature {
  flex-direction: row;
  align-items: baseline;
  gap: 7px;
  font-variant-numeric: tabular-nums;
}

.weatherForecastTemperature strong {
  font-size: 18px;
  font-weight: 500;
}

.weatherForecastTemperature span {
  color: var(--weather_dialog_subtle);
  font-size: 12px;
}

.weatherForecastMeta {
  min-width: 0;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 4px 10px;
  color: var(--weather_dialog_subtle);
  font-size: 9px;
  line-height: 13px;
}

.weatherForecastMeta span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.weatherIndexGrid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.weatherIndexItem {
  min-width: 0;
  padding: 14px;
  border: 1px solid var(--weather_dialog_line);
  border-radius: 8px;
  background: var(--weather_dialog_surface);
}

.weatherIndexItem header {
  justify-content: space-between;
  gap: 12px;
}

.weatherIndexItem h3 {
  margin: 0;
  font-size: 13px;
  font-weight: 650;
  line-height: 18px;
}

.weatherIndexItem header span {
  max-width: 62%;
  overflow: hidden;
  color: var(--weather_dialog_subtle);
  font-size: 9px;
  line-height: 14px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.weatherIndexItem > p {
  margin: 8px 0 0;
  color: var(--weather_dialog_muted);
  font-size: 10px;
  line-height: 17px;
  user-select: text;
}

.weatherIndexItem > p + p {
  margin-top: 3px;
  color: var(--weather_dialog_subtle);
}

.weatherEmptyState {
  min-height: 180px;
  border-top: 1px solid var(--weather_dialog_line);
  border-bottom: 1px solid var(--weather_dialog_line);
  display: grid;
  place-items: center;
  color: var(--weather_dialog_subtle);
  font-size: 12px;
}

.weather-dialog-enter-active,
.weather-dialog-leave-active {
  transition: opacity 0.24s ease;
}

.weather-dialog-enter-active .weatherDialogPanel,
.weather-dialog-leave-active .weatherDialogPanel {
  transition: opacity 0.24s ease, transform 0.24s cubic-bezier(0.16, 1, 0.3, 1);
}

.weather-dialog-enter-from,
.weather-dialog-leave-to,
.weather-dialog-enter-from .weatherDialogPanel,
.weather-dialog-leave-to .weatherDialogPanel {
  opacity: 0;
}

.weather-dialog-enter-from .weatherDialogPanel,
.weather-dialog-leave-to .weatherDialogPanel {
  transform: translate3d(0, 12px, 0) scale(0.985);
}

@media (max-width: 720px) {
  .weatherDialogBackdrop { padding: 8px; }

  .weatherDialogPanel {
    width: calc(100vw - 16px);
    max-height: calc(100dvh - 16px);
    border-radius: 16px;
  }

  .weatherDialogHeader {
    padding: 18px 18px 14px;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 14px;
  }

  .weatherDialogCurrent {
    grid-column: 1 / -1;
    grid-row: 2;
  }

  .weatherDialogActions { grid-column: 2; grid-row: 1; }
  .weatherTabs { padding-inline: 14px; }
  .weatherDialogBody { padding: 18px 18px 24px; }
  .weatherMetricGrid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .weatherPollutantGrid { grid-template-columns: repeat(3, minmax(0, 1fr)); }

  .weatherForecastItem {
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 10px 14px;
  }

  .weatherForecastCondition { grid-column: 1; grid-row: 2; }
  .weatherForecastTemperature { grid-column: 2; grid-row: 1 / 3; }
  .weatherForecastMeta { grid-column: 1 / -1; grid-row: 3; }
}

@media (max-width: 480px) {
  .weatherDialogTitle h2 { font-size: 17px; line-height: 23px; }
  .weatherDialogCurrent > strong { font-size: 34px; line-height: 38px; }
  .weatherSectionHeading { align-items: flex-end; }
  .weatherPollutantGrid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .weatherIndexGrid { grid-template-columns: 1fr; }
  .weatherAlertItem summary small { display: none; }
  .weatherForecastMeta { grid-template-columns: 1fr; }
}

@media (max-width: 360px) {
  .weatherSummaryMeta { gap: 5px; font-size: 9px; }
  .weatherSummaryMeta span + span::before { margin-right: 5px; }
  .weatherDialogHeader { padding-inline: 14px; }
  .weatherTabs { padding-inline: 10px; }
  .weatherTabs button { padding-inline: 10px; }
  .weatherDialogBody { padding: 16px 14px 22px; }
  .weatherMetricGrid > div { padding-inline: 10px; }
}

@media (prefers-reduced-motion: reduce) {
  .weatherDetails,
  .weatherDialogActions button,
  .weatherTabs button,
  .weather-dialog-enter-active,
  .weather-dialog-leave-active,
  .weather-dialog-enter-active .weatherDialogPanel,
  .weather-dialog-leave-active .weatherDialogPanel {
    transition: none;
  }

  .weatherTabPanel { animation: none; }
}
</style>
