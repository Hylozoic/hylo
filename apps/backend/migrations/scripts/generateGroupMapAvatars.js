#!/usr/bin/env node
/**
 * Script to generate map avatar variants for all existing group avatars in S3.
 *
 * This script:
 * 1. Lists all group avatars in S3 (under user/{userId}/groupAvatar/{groupId}/)
 * 2. For each avatar, checks if the map variant already exists
 * 3. If not, downloads the original, processes it to create a 42x42 circular PNG,
 *    and uploads it with the -forMap.png suffix
 *
 * Usage:
 *   node migrations/scripts/generateGroupMapAvatars.js
 *
 * Environment variables required:
 *   - AWS_ACCESS_KEY_ID
 *   - AWS_SECRET_ACCESS_KEY
 *   - AWS_S3_BUCKET
 *   - UPLOADER_PATH_PREFIX (e.g., 'evo-uploads')
 *   - UPLOADER_HOST (optional, for custom CDN)
 */

require('@babel/register')
require('dotenv').config()

const aws = require('aws-sdk')
const path = require('path')
const { parse } = require('url')
const request = require('request')
const sharp = require('sharp')
const { createS3StorageStream } = require('../../lib/uploader/storage')
const { GROUP_AVATAR } = require('../../lib/uploader/types')

const s3 = new aws.S3()

// Validate required environment variables
const requiredEnvVars = [
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
  'AWS_S3_BUCKET',
  'UPLOADER_PATH_PREFIX'
]

for (const key of requiredEnvVars) {
  if (!process.env[key]) {
    console.error(`Error: missing required environment variable: ${key}`)
    process.exit(1)
  }
}

const BUCKET = process.env.AWS_S3_BUCKET
const PATH_PREFIX = process.env.UPLOADER_PATH_PREFIX
const USER_PREFIX = `${PATH_PREFIX}/user/`

// Stats tracking
let stats = {
  total: 0,
  processed: 0,
  skipped: 0,
  errors: 0,
  startTime: Date.now()
}

/**
 * Get the public URL for an S3 object (for use with request)
 * Properly encodes the key to handle spaces and special characters
 */
function getS3Url (key) {
  const region = process.env.AWS_REGION || 'us-east-1'

  // Encode each path segment separately to preserve slashes
  const encodedKey = key.split('/').map(segment => encodeURIComponent(segment)).join('/')
  let url = `https://${BUCKET}.s3.${region}.amazonaws.com/${encodedKey}`

  // Apply UPLOADER_HOST if set (same logic as getFinalUrl in storage.js)
  if (process.env.UPLOADER_HOST) {
    const u = parse(url)
    u.host = process.env.UPLOADER_HOST
    url = u.format()
  }

  return url
}

/**
 * Check if a map variant already exists for a given group avatar
 */
async function mapVariantExists (originalKey) {
  const filename = path.basename(originalKey)
  const dir = path.dirname(originalKey)
  const mapVariantKey = path.join(dir, filename.replace(/(\.[a-zA-Z0-9]{2,4})?$/, '-forMap.png'))

  try {
    await s3.headObject({ Bucket: BUCKET, Key: mapVariantKey }).promise()
    return true
  } catch (err) {
    if (err.code === 'NotFound') {
      return false
    }
    throw err
  }
}

/**
 * Parse S3 key to extract userId and groupId
 * Handles both formats under user/:
 *   - {PATH_PREFIX}/user/{userId}/groupAvatar/{groupId}/{filename} (new)
 *   - {PATH_PREFIX}/user/{userId}/communityAvatar/{groupId}/{filename} (old)
 */
function parseGroupAvatarKey (key) {
  const parts = key.split('/')
  const userIndex = parts.indexOf('user')

  if (userIndex === -1 || parts.length < userIndex + 4) {
    return null
  }

  const userId = parts[userIndex + 1]
  const type = parts[userIndex + 2]
  const groupId = parts[userIndex + 3]

  // Accept both groupAvatar (new) and communityAvatar (old)
  if (type === 'groupAvatar' || type === 'communityAvatar') {
    return { userId, groupId, filename: parts.slice(userIndex + 4).join('/') }
  }

  return null
}

/**
 * Generate map variant for a group avatar
 */
function generateMapVariant (originalKey, userId, groupId, originalFilename) {
  return new Promise((resolve, reject) => {
    const sourceUrl = getS3Url(originalKey)

    const filenameForMap = (originalFilename || 'avatar')
      .replace(/\?.*$/, '')
      .replace(/(\.[a-zA-Z0-9]{2,4})?$/, '-forMap.png')

    const circleMaskSvg = Buffer.from('<svg width=\'42\' height=\'42\'><circle cx=\'21\' cy=\'21\' r=\'21\' fill=\'#fff\'/></svg>')
    const circleStrokeSvg = Buffer.from('<svg width=\'42\' height=\'42\'><circle cx=\'21\' cy=\'21\' r=\'20.5\' fill=\'none\' stroke=\'#000\' stroke-width=\'1\'/></svg>')
    const pngFileType = { mime: 'image/png', ext: 'png' }

    const sharpInstance = sharp()
      .rotate()
      .resize(42, 42, { fit: 'cover', withoutEnlargement: true })
      .composite([
        { input: circleMaskSvg, blend: 'dest-in' },
        { input: circleStrokeSvg, blend: 'over' }
      ])
      .png()
      .on('error', err => {
        reject(new Error(`Sharp processing error for ${sourceUrl} (S3 key: ${originalKey}): ${err.message}`))
      })

    const pipeline = request.get({ url: sourceUrl, encoding: null })
      .on('error', err => {
        reject(new Error(`Failed to fetch ${sourceUrl} (S3 key: ${originalKey}): ${err.message}`))
      })
      .pipe(sharpInstance)

    const storage = createS3StorageStream(GROUP_AVATAR, groupId, {
      userId,
      fileType: pngFileType,
      filename: filenameForMap
    })

    pipeline.pipe(storage)

    storage.on('finish', () => {
      resolve(storage.url)
    })

    storage.on('error', err => {
      reject(new Error(`Failed to upload map variant: ${err.message}`))
    })
  })
}

/**
 * Process a single group avatar
 */
async function processGroupAvatar (key) {
  const parsed = parseGroupAvatarKey(key)
  if (!parsed) {
    console.warn(`Warning: Could not parse key: ${key}`)
    return
  }

  const { userId, groupId, filename } = parsed

  // Skip if map variant already exists
  if (await mapVariantExists(key)) {
    stats.skipped++
    if (stats.skipped % 10 === 0) {
      console.log(`Skipped ${stats.skipped} (already have map variant)`)
    }
    return
  }

  try {
    await generateMapVariant(key, userId, groupId, filename)
    stats.processed++

    if (stats.processed % 10 === 0) {
      const elapsed = ((Date.now() - stats.startTime) / 1000).toFixed(1)
      console.log(`Processed ${stats.processed}/${stats.total} (${elapsed}s elapsed)`)
    }
  } catch (err) {
    stats.errors++
    console.error(`Error processing ${key}:`, err.message)
  }
}

/**
 * List all group avatars in S3 (both groupAvatar and communityAvatar under user/)
 */
async function listAllGroupAvatars () {
  const groupAvatars = []
  let continuationToken = null

  console.log(`Listing group avatars in S3 (prefix: ${USER_PREFIX})...`)

  do {
    const params = {
      Bucket: BUCKET,
      Prefix: USER_PREFIX
    }

    if (continuationToken) {
      params.ContinuationToken = continuationToken
    }

    const response = await s3.listObjectsV2(params).promise()

    // Filter for groupAvatar and communityAvatar objects
    const avatars = (response.Contents || [])
      .map(obj => obj.Key)
      .filter(key => {
        const parsed = parseGroupAvatarKey(key)
        if (!parsed) return false
        // Skip map variants themselves
        return !key.includes('-forMap.png')
      })

    groupAvatars.push(...avatars)

    continuationToken = response.NextContinuationToken

    if (response.Contents) {
      console.log(`Found ${groupAvatars.length} group avatars so far...`)
    }
  } while (continuationToken)

  return groupAvatars
}

/**
 * Main execution
 */
async function main () {
  console.log('Starting group map avatar generation script...\n')

  try {
    // List all group avatars
    const groupAvatars = await listAllGroupAvatars()
    stats.total = groupAvatars.length

    console.log(`\nFound ${stats.total} group avatars to process\n`)

    if (stats.total === 0) {
      console.log('No group avatars found. Exiting.')
      return
    }

    // Process each avatar (with concurrency limit to avoid overwhelming S3)
    const CONCURRENCY = 5
    for (let i = 0; i < groupAvatars.length; i += CONCURRENCY) {
      const batch = groupAvatars.slice(i, i + CONCURRENCY)
      await Promise.all(batch.map(key => processGroupAvatar(key)))
    }

    // Print final stats
    const elapsed = ((Date.now() - stats.startTime) / 1000).toFixed(1)
    console.log('\n' + '='.repeat(50))
    console.log('Final Statistics:')
    console.log(`  Total avatars found: ${stats.total}`)
    console.log(`  Successfully processed: ${stats.processed}`)
    console.log(`  Skipped (already exist): ${stats.skipped}`)
    console.log(`  Errors: ${stats.errors}`)
    console.log(`  Time elapsed: ${elapsed}s`)
    console.log('='.repeat(50))

    if (stats.errors > 0) {
      console.warn(`\nWarning: ${stats.errors} errors occurred. Check the output above for details.`)
      process.exit(1)
    }
  } catch (err) {
    console.error('Fatal error:', err)
    process.exit(1)
  }
}

// Run the script
main().catch(err => {
  console.error('Unhandled error:', err)
  process.exit(1)
})

