const { sortLocaleDeep } = require('./lib')

describe('sortLocaleDeep', () => {
  it('sorts keys case-insensitively', () => {
    const input = { banana: 1, apple: 2, cherry: 3 }
    const keys = Object.keys(sortLocaleDeep(input))
    expect(keys).toEqual(['apple', 'banana', 'cherry'])
  })

  it('sorts uppercase before lowercase when case-insensitive equal', () => {
    const input = { b: 1, A: 2, a: 3, B: 4 }
    const keys = Object.keys(sortLocaleDeep(input))
    expect(keys).toEqual(['A', 'a', 'B', 'b'])
  })

  it('sorts nested objects recursively', () => {
    const input = { z: { b: 1, a: 2 }, a: 3 }
    const result = sortLocaleDeep(input)
    expect(Object.keys(result)).toEqual(['a', 'z'])
    expect(Object.keys(result.z)).toEqual(['a', 'b'])
  })

  it('returns non-object values unchanged', () => {
    expect(sortLocaleDeep('hello')).toBe('hello')
    expect(sortLocaleDeep(42)).toBe(42)
    expect(sortLocaleDeep(null)).toBe(null)
  })

  it('handles arrays by sorting objects within them', () => {
    const input = [{ b: 1, a: 2 }]
    const result = sortLocaleDeep(input)
    expect(Object.keys(result[0])).toEqual(['a', 'b'])
  })
})
