/**
 * Shared utilities for subscription publishing
 */

/**
 * Wrapper to make publishing non-blocking using setImmediate
 */
export function publishAsync (publishFunction, ...args) {
  setImmediate(async () => {
    try {
      await publishFunction(...args)
    } catch (error) {
      console.error('❌ Error in background publishing:', error)
    }
  })
} 
