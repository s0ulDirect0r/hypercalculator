#!/usr/bin/env node
import { execSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { basename, resolve } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

import { zipFilePath } from './zip-name.mjs'

const apiBaseUrl = 'https://chromewebstore.googleapis.com'
const tokenUrl = 'https://oauth2.googleapis.com/token'
const commands = ['status', 'upload', 'submit', 'publish']

let parsed
try {
  parsed = parseArgs({
    allowPositionals: true,
    options: {
      help: { short: 'h', type: 'boolean' },
      staged: { type: 'boolean' },
      'skip-review': { type: 'boolean' },
      'block-on-warnings': { type: 'boolean' },
      'no-package': { type: 'boolean' },
      zip: { type: 'string' },
      'deploy-percentage': { type: 'string' },
      'poll-timeout': { type: 'string' },
      'poll-interval': { type: 'string' },
    },
  })
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  console.error('Run with --help for usage.')
  process.exit(1)
}

const flags = parsed.values
const command = parsed.positionals[0] ?? 'publish'

if (flags.help) {
  printHelp()
  process.exit(0)
}

try {
  // Validate all input before touching credentials or the network, so typos
  // fail fast and offline.
  if (parsed.positionals.length > 1) {
    throw new Error(`Expected a single command, got "${parsed.positionals.join(' ')}".`)
  }
  if (!commands.includes(command)) {
    throw new Error(`Unknown command "${command}". Run with --help for usage.`)
  }

  const publishBody = buildPublishBody(flags)
  const pollTimeoutSeconds = parseSeconds('--poll-timeout', flags['poll-timeout'], 120)
  const pollIntervalSeconds = parseSeconds('--poll-interval', flags['poll-interval'], 5)

  loadEnvFiles()

  await main(command, { publishBody, pollIntervalSeconds, pollTimeoutSeconds })
} catch (error) {
  console.error(`\nChrome Web Store ${command} failed:`)
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
}

async function main(action, options) {
  const context = {
    publisherId: requiredEnv('CWS_PUBLISHER_ID'),
    extensionId: requiredEnv('CWS_EXTENSION_ID'),
    clientId: requiredEnv('CWS_CLIENT_ID'),
    clientSecret: requiredEnv('CWS_CLIENT_SECRET'),
    refreshToken: requiredEnv('CWS_REFRESH_TOKEN'),
  }

  const accessToken = await refreshAccessToken(context)

  if (action === 'status') {
    await printStatus(context, accessToken)
    return
  }

  if (action === 'upload') {
    await uploadPackage(context, accessToken, options)
    return
  }

  if (action === 'submit') {
    await submitPublish(context, accessToken, options)
    return
  }

  await uploadPackage(context, accessToken, options)
  await submitPublish(context, accessToken, options)
}

async function refreshAccessToken(context) {
  const payload = await requestJson(tokenUrl, {
    method: 'POST',
    body: new URLSearchParams({
      client_id: context.clientId,
      client_secret: context.clientSecret,
      grant_type: 'refresh_token',
      refresh_token: context.refreshToken,
    }),
  })

  if (!payload.access_token) {
    throw new Error('OAuth token response did not include access_token.')
  }

  return payload.access_token
}

async function uploadPackage(context, accessToken, options) {
  const zipPath = flags.zip ? resolve(flags.zip) : zipFilePath()

  // An explicit --zip means "upload this exact archive" — never rebuild,
  // or the freshly packed zip would silently replace the chosen one.
  if (!flags.zip && !flags['no-package']) {
    execSync('npm run package', { stdio: 'inherit' })
  }

  if (!existsSync(zipPath)) {
    throw new Error(`Package not found: ${zipPath}`)
  }

  const zipBytes = readFileSync(zipPath)
  const uploadUrl = `${apiBaseUrl}/upload/v2/${resourceName(context)}:upload`

  console.log(`\nUploading ${basename(zipPath)} to Chrome Web Store...`)
  const payload = await requestJson(uploadUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/zip',
    },
    body: zipBytes,
  })

  printJson('Upload response', payload)

  if (payload.uploadState === 'IN_PROGRESS') {
    await waitForUpload(context, accessToken, options)
    return
  }

  if (payload.uploadState !== 'SUCCEEDED') {
    throw new Error(`Upload did not succeed. uploadState=${payload.uploadState}`)
  }
}

async function waitForUpload(context, accessToken, options) {
  const { pollIntervalSeconds, pollTimeoutSeconds } = options
  const deadline = Date.now() + pollTimeoutSeconds * 1000

  console.log(`Upload is still processing. Polling status for up to ${pollTimeoutSeconds}s...`)

  while (true) {
    const remainingMs = deadline - Date.now()
    if (remainingMs <= 0) {
      throw new Error(
        `Upload still processing after ${pollTimeoutSeconds}s. Check later with: npm run cws:status`,
      )
    }

    // Sleep before reading status: an instant read can still reflect the
    // previous upload's state.
    await sleep(Math.min(pollIntervalSeconds * 1000, remainingMs))
    const status = await fetchStatus(context, accessToken)
    const uploadState = status.lastAsyncUploadState
    console.log(`lastAsyncUploadState=${uploadState}`)

    if (uploadState === 'SUCCEEDED') {
      return
    }

    if (uploadState === 'FAILED') {
      printJson('Status response', status)
      throw new Error('Upload processing failed.')
    }
  }
}

async function submitPublish(context, accessToken, options) {
  console.log('\nSubmitting item for Chrome Web Store publishing...')
  const payload = await requestJson(`${apiBaseUrl}/v2/${resourceName(context)}:publish`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(options.publishBody),
  })

  printJson('Publish response', payload)
}

async function printStatus(context, accessToken) {
  const status = await fetchStatus(context, accessToken)
  printJson('Status response', status)
}

function fetchStatus(context, accessToken) {
  return requestJson(`${apiBaseUrl}/v2/${resourceName(context)}:fetchStatus`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
}

async function requestJson(url, init) {
  const response = await fetch(url, init)
  const payload = await readJsonResponse(response)

  if (!response.ok) {
    throw new Error(formatHttpError(response, payload))
  }

  return payload
}

function buildPublishBody(flags) {
  const body = {}

  if (flags.staged) {
    body.publishType = 'STAGED_PUBLISH'
  }

  if (flags['skip-review']) {
    body.skipReview = true
  }

  if (flags['block-on-warnings']) {
    body.blockOnWarnings = true
  }

  if (flags['deploy-percentage'] !== undefined) {
    const deployPercentage = Number(flags['deploy-percentage'])
    if (!Number.isInteger(deployPercentage) || deployPercentage < 0 || deployPercentage > 100) {
      throw new Error('--deploy-percentage must be an integer from 0 to 100.')
    }
    body.deployInfos = [{ deployPercentage }]
  }

  return body
}

function parseSeconds(name, value, defaultSeconds) {
  if (value === undefined) {
    return defaultSeconds
  }

  const seconds = Number(value)
  if (!Number.isFinite(seconds) || seconds <= 0) {
    throw new Error(`${name} must be a positive number of seconds, got "${value}".`)
  }

  return seconds
}

function resourceName(context) {
  return `publishers/${context.publisherId}/items/${context.extensionId}`
}

async function readJsonResponse(response) {
  const text = await response.text()

  if (!text) {
    return {}
  }

  try {
    return JSON.parse(text)
  } catch {
    return { rawBody: text }
  }
}

function formatHttpError(response, payload) {
  const details = payload.error ?? payload
  return `${response.status} ${response.statusText}\n${JSON.stringify(details, null, 2)}`
}

function requiredEnv(name) {
  const value = process.env[name]

  if (!value) {
    throw new Error(`Missing ${name}. Set it in your shell, .env.local, or .env.`)
  }

  return value
}

function loadEnvFiles() {
  // .env.local wins over .env, and real shell variables win over both —
  // process.loadEnvFile never overrides variables that are already set.
  for (const file of ['../.env.local', '../.env']) {
    const path = fileURLToPath(new URL(file, import.meta.url))
    if (existsSync(path)) {
      process.loadEnvFile(path)
    }
  }
}

function printJson(label, value) {
  console.log(`\n${label}:`)
  console.log(JSON.stringify(value, null, 2))
}

function printHelp() {
  console.log(`
Usage:
  npm run cws:status
  npm run cws:upload -- [--zip hypercalculator-v1.0.0.zip] [--no-package]
  npm run cws:submit -- [--staged] [--skip-review] [--block-on-warnings]
  npm run cws:publish -- [--staged] [--skip-review] [--block-on-warnings]

Commands:
  status    Fetch the current Chrome Web Store item status.
  upload    Run npm run package, then upload the ZIP.
  submit    Submit the latest uploaded package for publishing.
  publish   Upload the ZIP, then submit it for publishing. This is the default.

Credentials come from your shell, .env.local, or .env (first match wins):
  CWS_PUBLISHER_ID
  CWS_EXTENSION_ID
  CWS_CLIENT_ID
  CWS_CLIENT_SECRET
  CWS_REFRESH_TOKEN

Optional flags:
  --zip <path>                 Upload this exact archive (skips the build).
  --no-package                 Skip npm run package before uploading.
  --deploy-percentage <0-100>  Initial rollout percentage.
  --poll-timeout <seconds>     Upload processing timeout. Default: 120.
  --poll-interval <seconds>    Upload status polling interval. Default: 5.
`)
}
