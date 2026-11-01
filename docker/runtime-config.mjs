import { loadConfig } from '../server/config.js'

// HTTP cookies are allowed only for local evaluation. The existing VPS entry
// point and production-cookie policy are not changed by the Docker launcher.
export function dockerRuntimeConfig(env = process.env) {
  const origin = new URL(env.JOBFINDER_APP_ORIGIN || 'http://localhost:8080')
  const localHttp = origin.protocol === 'http:' &&
    ['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname)
  if ((!localHttp && origin.protocol !== 'https:') || origin.username ||
      origin.password || origin.pathname !== '/' || origin.search || origin.hash) {
    throw new Error('Use a plain localhost HTTP origin or an HTTPS origin for JOBFINDER_APP_ORIGIN')
  }
  return loadConfig({
    appOrigin: origin.origin,
    secureCookies: !localHttp,
  })
}
