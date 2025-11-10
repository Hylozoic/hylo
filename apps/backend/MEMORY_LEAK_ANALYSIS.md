# Memory Leak Analysis Report

## Overview
This document identifies potential memory leaks found in the codebase that could be causing production server memory issues.

## Critical Issues Found

### 1. RedisPubSub.js - Redis Clients Never Closed ⚠️ CRITICAL
**Location:** `api/services/RedisPubSub.js`

**Problem:**
- Creates two Redis clients at module level (`publishClient` and `subscribeClient`)
- These clients are never closed, leading to connection leaks
- Each time the module is loaded, new connections are created but old ones remain

**Impact:** High - Redis connections accumulate over time

**Fix Required:**
- Implement proper cleanup/shutdown handlers
- Ensure clients are closed on application shutdown
- Consider connection pooling or reuse

---

### 2. RedisClient.js - No Cleanup Mechanism ⚠️ CRITICAL
**Location:** `api/services/RedisClient.js`

**Problem:**
- Creates new Redis clients on each `create()` call
- No mechanism to track or close these clients
- Clients accumulate if not properly managed by callers

**Impact:** High - Multiple Redis clients can be created without cleanup

**Fix Required:**
- Add connection pooling or reuse
- Implement cleanup tracking
- Ensure clients are closed when no longer needed

---

### 3. Websockets.js - Socket.io-Emitter Never Closed ⚠️ CRITICAL
**Location:** `api/services/Websockets.js`

**Problem:**
- Creates a `socket.io-emitter` instance stored in module-level variable `io`
- The emitter uses Redis connection that's never closed
- If `sails.sockets` is unavailable, a new emitter is created but never cleaned up

**Impact:** High - Redis connection leaks through socket.io-emitter

**Fix Required:**
- Add cleanup/shutdown handler
- Close Redis connection on application shutdown
- Track emitter instance for proper cleanup

---

### 4. GraphQL Subscriptions - Async Iterator Cleanup ⚠️ HIGH
**Location:** `api/graphql/makeSubscriptions.js`

**Problem:**
- The `allUpdates` subscription creates multiple async iterators (5 subscriptions)
- When clients disconnect, these iterators may not be properly cleaned up
- Redis subscriptions may remain active even after client disconnects
- The `mergedStream` function creates promises that may not be cleaned up

**Impact:** High - Subscriptions accumulate, Redis connections stay open

**Fix Required:**
- Implement proper cleanup when subscriptions end
- Use GraphQL Yoga's built-in cleanup mechanisms
- Ensure Redis subscriptions are unsubscribed on disconnect

---

### 5. queryMonitor.js - Query Accumulation Potential ⚠️ MEDIUM
**Location:** `lib/util/queryMonitor.js`

**Problem:**
- The `times` object stores query metadata
- If queries don't complete properly, entries may remain in the object
- While there's cleanup logic, edge cases could cause accumulation

**Impact:** Medium - Could accumulate if queries fail or timeout

**Fix Required:**
- Add timeout/cleanup for incomplete queries
- Size limit on `times` object
- Periodic cleanup of stale entries

---

### 6. Worker.js - Queue Shutdown Only on Stop Callback ⚠️ MEDIUM
**Location:** `worker.js`

**Problem:**
- Kue queue is only shut down in the `stop` callback
- If worker crashes or restarts unexpectedly, queue connections may not be cleaned up

**Impact:** Medium - Redis connections from Kue may leak on crashes

**Fix Required:**
- Add process exit handlers
- Ensure queue cleanup on unexpected shutdowns

---

### 7. app.js - Cluster Exit Handler Missing Cleanup ⚠️ LOW
**Location:** `app.js`

**Problem:**
- Cluster exit handler only logs, doesn't clean up resources
- Worker processes may leave connections open when they die

**Impact:** Low - Could contribute to leaks on worker crashes

**Fix Required:**
- Ensure proper cleanup before worker exits
- Consider graceful shutdown handling

---

## Fixes Applied ✅

### 1. RedisPubSub.js - FIXED ✅
- Added cleanup handlers for Redis clients on process exit
- Clients are now properly closed on SIGTERM, SIGINT, and exit
- Uses connection pool with unique keys ('pubsub-publish', 'pubsub-subscribe')

### 2. RedisClient.js - FIXED ✅
- Implemented connection pooling to reuse connections
- Connections are tracked and cleaned up on process exit
- Dead connections are automatically removed from pool
- Added connection health checks

### 3. Websockets.js - FIXED ✅
- Added cleanup handlers for socket.io-emitter Redis connection
- Connection is properly closed on process exit
- Cleanup handlers registered to prevent leaks

### 4. queryMonitor.js - FIXED ✅
- Added periodic cleanup (every 10 seconds) to remove stale queries
- Maximum query age limit (30 seconds)
- Maximum queries tracked (1000) with automatic cleanup of oldest
- Cleanup interval properly cleaned up on process exit

### 5. worker.js - IMPROVED ✅
- Added uncaught exception handler to ensure queue cleanup
- Added unhandled rejection logging

### 6. GraphQL Subscriptions - FIXED ✅
- Added proper cleanup for async iterators in `allUpdates` subscription
- Iterators are now properly closed using `return()` method when subscription ends
- Added try/finally blocks to ensure cleanup even if errors occur
- Promises array is cleared on cleanup
- All 5 subscription iterators are properly closed when client disconnects
- Added development logging for cleanup tracking

## Recommended Fix Priority (BEFORE FIXES)

1. **Immediate (Critical):**
   - ✅ Fix RedisPubSub.js - Redis clients never closed
   - ✅ Fix Websockets.js - socket.io-emitter never closed
   - ✅ Fix GraphQL subscriptions cleanup - async iterators properly closed

2. **High Priority:**
   - ✅ Fix RedisClient.js cleanup mechanism
   - ✅ Add proper shutdown handlers

3. **Medium Priority:**
   - ✅ Fix queryMonitor.js potential accumulation
   - ✅ Improve worker.js cleanup

---

## Additional Observations

- No `.removeListener()` or `.off()` calls found - suggests event listeners may accumulate
- Global variables are used but appear to be intentional for DI
- Database connection pool is configured (max: 30) which is good
- Redis URL is used from env, but connections aren't pooled efficiently

---

## Monitoring Recommendations

1. Enable `DEBUG_MEMORY` flag to use memwatch
2. Monitor Redis connection count
3. Monitor GraphQL subscription count
4. Add metrics for async iterator cleanup
5. Monitor database connection pool usage

