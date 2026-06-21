import { createClient } from 'redis'
import { logger } from '../utils/logger.js'

let redisConnected = false
let redisAvailable = false

export const redis = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  socket: {
    reconnectStrategy: () => false,
  },
})

redis.on('error', () => {
  // Silently ignore Redis errors
})

redis.on('connect', () => {
  redisConnected = true
  redisAvailable = true
  console.log('✅ Redis connected')
})

export async function connectRedis() {
  try {
    await redis.connect()
    redisAvailable = true
  } catch {
    // Redis not available, app works without cache
  }
}

export async function getCache(key) {
  if (!redisAvailable) return null
  try {
    return await redis.get(key)
  } catch (error) {
    logger.warn(null, 'Redis get failed', { key, error: error.message })
    return null
  }
}

export async function setCache(key, value, ttl = 300) {
  if (!redisAvailable) return
  try {
    await redis.setEx(key, ttl, value)
  } catch (error) {
    logger.warn(null, 'Redis set failed', { key, error: error.message })
  }
}

export async function delCache(key) {
  if (!redisAvailable) return
  try {
    if (key.includes('*')) {
      const keys = await redis.keys(key)
      if (keys.length) await redis.del(keys)
    } else {
      await redis.del(key)
    }
  } catch (error) {
    logger.warn(null, 'Redis del failed', { key, error: error.message })
  }
}
