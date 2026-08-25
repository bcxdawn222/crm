import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { chromium } from '@playwright/test'

const root = process.cwd()
const baseUrl = process.env.CRM_PERF_BASE_URL
const username = process.env.CRM_PERF_USERNAME
const password = process.env.CRM_PERF_PASSWORD
const chromePath = process.env.CRM_CHROME_PATH
const timestamp = new Date().toISOString().replaceAll(':', '').replaceAll('-', '').replace(/\.\d{3}Z$/, 'Z')
const reportPath = path.join(root, 'logs', 'test', `frontend-runtime-${timestamp}.json`)
const documentPath = path.join(root, 'docs', '前端运行时性能.md')

if (!baseUrl || !username || !password || !chromePath) {
  throw new Error('前端运行时性能环境变量不完整')
}

const profiles = [
  {
    name: 'desktop',
    label: '桌面环境',
    cpuRate: 1,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: -1,
    routes: ['/', '/statistics', '/public-pool', '/customers/cooperating', '/files', '/messages'],
  },
  {
    name: 'constrained',
    label: '低性能环境（4 倍 CPU 降速、150 ms 延迟、1.6 Mbps 下载）',
    cpuRate: 4,
    latency: 150,
    downloadThroughput: 200 * 1024,
    uploadThroughput: 75 * 1024,
    routes: ['/', '/statistics', '/customers/cooperating'],
  },
]

const interactions = new Map([
  ['/', '.ant-radio-button-wrapper'],
  ['/statistics', '.ant-tabs-tab:nth-child(2)'],
  ['/public-pool', '.ant-space .ant-btn-primary'],
])

async function installObservers(page) {
  await page.addInitScript(() => {
    window.__crmPerformance = { cls: 0, lcp: 0, longTasks: [], events: [], shifts: [] }
    const supported = PerformanceObserver.supportedEntryTypes
    if (supported.includes('layout-shift')) {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!entry.hadRecentInput) {
            window.__crmPerformance.cls += entry.value
            window.__crmPerformance.shifts.push({
              value: entry.value,
              startTime: entry.startTime,
              sources: (entry.sources ?? []).map((source) => ({
                node: source.node?.outerHTML?.slice(0, 180) ?? source.node?.nodeName ?? 'unknown',
                previousRect: source.previousRect,
                currentRect: source.currentRect,
              })),
            })
          }
        }
      }).observe({ type: 'layout-shift', buffered: true })
    }
    if (supported.includes('largest-contentful-paint')) {
      new PerformanceObserver((list) => {
        const entries = list.getEntries()
        const latest = entries.at(-1)
        if (latest) window.__crmPerformance.lcp = latest.startTime
      }).observe({ type: 'largest-contentful-paint', buffered: true })
    }
    if (supported.includes('longtask')) {
      new PerformanceObserver((list) => {
        window.__crmPerformance.longTasks.push(...list.getEntries().map((entry) => entry.duration))
      }).observe({ type: 'longtask', buffered: true })
    }
    if (supported.includes('event')) {
      new PerformanceObserver((list) => {
        window.__crmPerformance.events.push(...list.getEntries().map((entry) => ({
          duration: entry.duration,
          interactionId: entry.interactionId,
        })))
      }).observe({ type: 'event', buffered: true, durationThreshold: 16 })
    }
  })
}

async function login(page) {
  await page.goto(`${baseUrl}/login`, { waitUntil: 'networkidle' })
  await page.getByPlaceholder('用户名').fill(username)
  await page.getByPlaceholder('密码').fill(password)
  await page.locator('button[type="submit"]').click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 20000 })
  await page.waitForLoadState('networkidle')
}

async function applyProfile(page, profile) {
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Network.enable')
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: profile.cpuRate })
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: profile.latency,
    downloadThroughput: profile.downloadThroughput,
    uploadThroughput: profile.uploadThroughput,
  })
  return cdp
}

async function measureRoute(page, route) {
  const startedAt = Date.now()
  await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle', timeout: 45000 })
  await page.waitForTimeout(1200)
  const interaction = interactions.get(route)
  let interactionWallMs = null
  if (interaction) {
    const target = page.locator(interaction).first()
    if (await target.isVisible().catch(() => false)) {
      const actionStartedAt = Date.now()
      await target.click()
      interactionWallMs = Date.now() - actionStartedAt
      await page.waitForTimeout(500)
    }
  }
  const browserMetrics = await page.evaluate((hasInteraction) => {
    const navigation = performance.getEntriesByType('navigation')[0]
    const state = window.__crmPerformance
    const interactionEvents = state.events.filter((entry) => entry.interactionId > 0)
    return {
      ttfbMs: navigation?.responseStart ?? 0,
      domContentLoadedMs: navigation?.domContentLoadedEventEnd ?? 0,
      loadMs: navigation?.loadEventEnd ?? 0,
      lcpMs: state.lcp,
      cls: state.cls,
      longTaskCount: state.longTasks.length,
      longTaskTotalMs: state.longTasks.reduce((total, duration) => total + duration, 0),
      longTaskMaxMs: Math.max(0, ...state.longTasks),
      inpMs: !hasInteraction
        ? null
        : interactionEvents.length > 0
          ? Math.max(...interactionEvents.map((entry) => entry.duration))
          : 0,
      shifts: state.shifts,
    }
  }, interactionWallMs !== null)
  return { route, wallLoadMs: Date.now() - startedAt, interactionWallMs, ...browserMetrics }
}

async function measureTransition(page) {
  await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' })
  const startedAt = Date.now()
  await page.getByRole('link', { name: '数据统计' }).click()
  await page.waitForURL(`${baseUrl}/statistics`)
  await page.waitForLoadState('networkidle')
  return Date.now() - startedAt
}

function findFailures(results) {
  const failures = []
  for (const result of results) {
    const lcpBudget = result.profile === 'desktop' ? 3000 : 5000
    const transitionBudget = result.profile === 'desktop' ? 1500 : 2500
    for (const page of result.pages) {
      if (page.lcpMs <= 0 || page.lcpMs > lcpBudget) failures.push(`${result.profile}${page.route} LCP=${page.lcpMs}`)
      if (page.cls > 0.1) failures.push(`${result.profile}${page.route} CLS=${page.cls}`)
      if (page.longTaskMaxMs > 500) failures.push(`${result.profile}${page.route} longTask=${page.longTaskMaxMs}`)
      if (page.inpMs !== null && page.inpMs > 500) failures.push(`${result.profile}${page.route} INP=${page.inpMs}`)
    }
    if (result.routeTransitionMs > transitionBudget) {
      failures.push(`${result.profile} routeTransition=${result.routeTransitionMs}`)
    }
  }
  return failures
}

function markdown(results, environment, failures) {
  const rows = results.flatMap((result) => result.pages.map((page) => (
    `| ${result.label} | \`${page.route}\` | ${page.lcpMs.toFixed(0)} ms | ${page.cls.toFixed(3)} | `
    + `${page.inpMs === null ? '未采集' : `${page.inpMs.toFixed(0)} ms`} | ${page.longTaskCount} / ${page.longTaskMaxMs.toFixed(0)} ms | ${page.wallLoadMs} ms |`
  )))
  const transitions = results.map((result) => `- ${result.label}路由切换：${result.routeTransitionMs} ms`)
  return [
    '# 前端运行时性能',
    '',
    `- 测试时间：${new Date().toISOString()}`,
    `- Chrome：${environment.browserVersion}`,
    `- 视口：${environment.viewport.width} × ${environment.viewport.height}`,
    `- 结果文件：\`${reportPath}\``,
    '- INP 仅在执行了明确只读交互的页面采集；没有安全交互的页面标记为“未采集”。',
    ...transitions,
    '',
    '| 环境 | 路由 | LCP | CLS | INP | 长任务数 / 最大值 | 页面完成耗时 |',
    '|---|---|---:|---:|---:|---:|---:|',
    ...rows,
    '',
    failures.length === 0 ? '预算结果：通过。' : `预算结果：未通过（${failures.join('；')}）。`,
    '',
  ].join('\n')
}

const browser = await chromium.launch({ executablePath: chromePath, headless: true })
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'zh-CN' })
const page = await context.newPage()
await installObservers(page)

try {
  await login(page)
  const results = []
  for (const profile of profiles) {
    const cdp = await applyProfile(page, profile)
    const pages = []
    for (const route of profile.routes) pages.push(await measureRoute(page, route))
    const routeTransitionMs = await measureTransition(page)
    results.push({ profile: profile.name, label: profile.label, routeTransitionMs, pages })
    await cdp.detach()
  }
  const environment = {
    browserVersion: await browser.version(),
    viewport: page.viewportSize(),
  }
  const failures = findFailures(results)
  await fs.mkdir(path.dirname(reportPath), { recursive: true })
  await fs.writeFile(reportPath, JSON.stringify({ environment, results, failures }, null, 2), 'utf8')
  await fs.writeFile(documentPath, markdown(results, environment, failures), 'utf8')
  console.log(`前端运行时性能报告: ${reportPath}`)
  console.log(`前端运行时性能文档: ${documentPath}`)
  if (failures.length > 0) {
    console.error(`前端运行时性能预算未通过: ${failures.join(', ')}`)
    process.exitCode = 1
  }
} finally {
  await browser.close()
}
