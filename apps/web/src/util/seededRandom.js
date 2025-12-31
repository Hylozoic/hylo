/**
 * Simple seeded pseudo-random number generator
 * Uses a Linear Congruential Generator (LCG) algorithm
 * This ensures deterministic randomness based on a seed value
 */
class SeededRandom {
  constructor (seed) {
    // Convert seed to a number if it's a string
    this.seed = typeof seed === 'string' ? this.hashString(seed) : seed
    this.current = this.seed
  }

  /**
   * Hash a string to a number
   * Simple hash function for converting user IDs to numeric seeds
   */
  hashString (str) {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return Math.abs(hash)
  }

  /**
   * Generate next random number between 0 and 1
   * Uses LCG: (a * seed + c) mod m
   */
  next () {
    // LCG parameters (same as used in many standard libraries)
    const a = 1664525
    const c = 1013904223
    const m = Math.pow(2, 32)
    this.current = (a * this.current + c) % m
    return this.current / m
  }

  /**
   * Generate random integer between min (inclusive) and max (exclusive)
   */
  nextInt (min, max) {
    return Math.floor(this.next() * (max - min)) + min
  }
}

/**
 * Shuffle an array using a seeded random number generator
 * This ensures the same seed produces the same shuffle order
 */
export function seededShuffle (array, seed) {
  if (!array || array.length === 0) return array

  const rng = new SeededRandom(seed)
  const shuffled = [...array]

  // Fisher-Yates shuffle algorithm with seeded random
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = rng.nextInt(0, i + 1)
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }

  return shuffled
}

export default SeededRandom
