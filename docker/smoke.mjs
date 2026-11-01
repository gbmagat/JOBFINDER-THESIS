import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// Run only against the disposable CI container, never the live website.
const base = new URL(process.env.JOBFINDER_SMOKE_URL || 'http://localhost:8080')
assert.ok(['localhost', '127.0.0.1'].includes(base.hostname), 'Smoke tests are local-only')
const mode = process.argv[2] || 'create'
assert.ok(['create', 'persisted'].includes(mode))
const account = {
  role: 'job-seeker', email: 'docker-smoke@example.invalid',
  password: 'Disposable-Smoke!42', firstName: 'Docker', lastName: 'Check',
}
const pdf = '%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF'
let cookie = ''
async function request(route, { method = 'GET', body, form, origin = base.origin } = {}) {
  const headers = { origin }
  if (cookie) headers.cookie = cookie
  if (body) headers['content-type'] = 'application/json'
  return fetch(new URL(route, base), {
    method, headers, body: form || (body ? JSON.stringify(body) : undefined),
    signal: AbortSignal.timeout(10_000),
  })
}
const home = await request('/')
assert.equal(home.status, 200)
const html = await home.text()
assert.match(html, /<div id="root"/)
assert.doesNotMatch(html, /src="\/Jobfinder\//)
const scriptPath = html.match(/src="([^"]+\.js)"/)?.[1]
assert.ok(scriptPath, 'Built JavaScript must exist')
const script = await request(scriptPath)
assert.equal(script.status, 200)
assert.match(script.headers.get('content-type'), /javascript/)
assert.deepEqual(await (await request('/api/health')).json(), { ok: true, database: 'ok' })
const expectedJobs = JSON.parse(readFileSync(new URL('../src/data/jobs.verified.json', import.meta.url))).length
const jobs = await (await request('/api/jobs')).json()
assert.equal(jobs.total, expectedJobs)
const road = await request('/data/roadGraph.json')
assert.equal(road.status, 200)
assert.ok((await road.text()).length > 1000)
for (const route of ['/.env', '/server/schema.sql', '/uploads/test.pdf', '/data/jobfinder.sqlite']) {
  assert.equal((await request(route)).status, 404, route + ' must not expose private files')
}
assert.equal((await request('/api/auth/me')).status, 401)
const auth = mode === 'create'
  ? await request('/api/auth/register', { method: 'POST', body: account })
  : await request('/api/auth/login', { method: 'POST', body: { email: account.email, password: account.password } })
assert.ok(auth.ok, 'Authentication must succeed: ' + auth.status)
cookie = auth.headers.get('set-cookie')?.match(/jf_session=[^;]+/)?.[0]
assert.ok(cookie, 'A login cookie is required')
assert.doesNotMatch(auth.headers.get('set-cookie'), /;\s*Secure/i, 'Local HTTP must work')
assert.equal((await request('/api/auth/me')).status, 200)
const wrongOrigin = await request('/api/auth/login', {
  method: 'POST', body: { email: account.email, password: account.password },
  origin: 'https://not-jobfinder.invalid',
})
assert.equal(wrongOrigin.status, 403, 'Cross-origin mutations must still be blocked')
if (mode === 'create') {
  const form = new FormData()
  form.set('resume', new Blob([pdf], { type: 'application/pdf' }), 'synthetic-test.pdf')
  const upload = await request('/api/me/resume', { method: 'PUT', form })
  assert.ok(upload.ok, 'Synthetic resume upload must work: ' + upload.status)
}
const download = await request('/api/me/resume/download')
assert.equal(download.status, 200)
assert.equal(await download.text(), pdf, 'Uploaded data must survive container replacement')
console.log('Docker smoke checks passed (' + mode + '): frontend, API, seed, login, origin protection, private files and resume storage')
