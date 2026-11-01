import assert from 'node:assert/strict'
import test from 'node:test'
import { dockerRuntimeConfig } from './runtime-config.mjs'

test('Docker local evaluation can use HTTP cookies without changing API binding', () => {
  const config = dockerRuntimeConfig({})
  assert.equal(config.appOrigin, 'http://localhost:8080')
  assert.equal(config.secureCookies, false)
  assert.equal(config.host, '127.0.0.1')
})
test('HTTPS deployments always use secure cookies', () => {
  const config = dockerRuntimeConfig({ JOBFINDER_APP_ORIGIN: 'https://example.com' })
  assert.equal(config.secureCookies, true)
})
test('Docker rejects external HTTP origins and invalid origin components', () => {
  for (const value of [
    'http://example.com', 'http://192.168.1.2:8080', 'ftp://localhost',
    'https://example.com/app', 'https://example.com?x=1',
    'https://example.com#x', 'https://user:pass@example.com',
  ]) assert.throws(() => dockerRuntimeConfig({ JOBFINDER_APP_ORIGIN: value }))
})
