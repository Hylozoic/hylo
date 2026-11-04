import validateCustomViewForm from './validateCustomViewForm'
import { DEFAULT_SELECTED_POST_TYPES } from './customViewFormConstants'

describe('validateCustomViewForm', () => {
  it('accepts a named view with the default post types, including requests and offers', () => {
    expect(DEFAULT_SELECTED_POST_TYPES).toEqual(expect.arrayContaining(['request', 'offer']))
    expect(validateCustomViewForm({ name: 'Garden', postTypes: DEFAULT_SELECTED_POST_TYPES })).toEqual({})
  })

  it('accepts a view showing only requests or only offers', () => {
    expect(validateCustomViewForm({ name: 'Asks', postTypes: ['request'] })).toEqual({})
    expect(validateCustomViewForm({ name: 'Gifts', postTypes: ['offer'] })).toEqual({})
  })

  it('flags a missing, blank or one-character name', () => {
    expect(validateCustomViewForm({ name: '', postTypes: ['discussion'] })).toEqual({ name: true })
    expect(validateCustomViewForm({ name: '   ', postTypes: ['discussion'] })).toEqual({ name: true })
    expect(validateCustomViewForm({ name: ' a ', postTypes: ['discussion'] })).toEqual({ name: true })
    expect(validateCustomViewForm({ postTypes: ['discussion'] })).toEqual({ name: true })
  })

  it('flags an empty post type selection', () => {
    expect(validateCustomViewForm({ name: 'Garden', postTypes: [] })).toEqual({ postTypes: true })
    expect(validateCustomViewForm({ name: 'Garden' })).toEqual({ postTypes: true })
  })
})
