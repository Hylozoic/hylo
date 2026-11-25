import { defaultProjectColumns, projectColumnsForCreate, projectColumnsValid, projectSpaceViewTypes } from './ProjectColumnsFields'

const t = key => key

describe('project starting columns', () => {
  it('starts with the four default columns, ending in a done column', () => {
    const columns = defaultProjectColumns(t)
    expect(columns.map(c => c.category)).toEqual(['todo', 'active', 'active', 'done'])
    expect(projectColumnsValid(columns)).toBe(true)
  })

  it('sends named columns only, trimmed, in order', () => {
    expect(projectColumnsForCreate([
      { key: 'a', name: ' Ideas ', category: 'todo' },
      { key: 'b', name: '  ', category: 'active' },
      { key: 'c', name: 'Shipped', category: 'done' }
    ])).toEqual([{ name: 'Ideas', category: 'todo' }, { name: 'Shipped', category: 'done' }])
  })

  it('needs a named done column', () => {
    expect(projectColumnsValid([{ key: 'a', name: 'Ideas', category: 'todo' }])).toBe(false)
    expect(projectColumnsValid([{ key: 'a', name: '', category: 'done' }])).toBe(false)
  })
})

describe('project space views', () => {
  it('always opens on Tasks', () => {
    expect(projectSpaceViewTypes(['tasks', 'chat', 'members'])).toEqual(['tasks', 'chat', 'members'])
    expect(projectSpaceViewTypes(['chat', 'tasks', 'members'])).toEqual(['tasks', 'chat', 'members'])
    expect(projectSpaceViewTypes(['chat', 'members'])).toEqual(['tasks', 'chat', 'members'])
    expect(projectSpaceViewTypes(undefined)).toEqual(['tasks'])
  })
})
