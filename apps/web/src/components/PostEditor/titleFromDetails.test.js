/* eslint-env jest */
import titleFromDetails, { isTitleOptional } from './titleFromDetails'

describe('titleFromDetails', () => {
  it('uses short text as it is, without markup', () => {
    expect(titleFromDetails('<p>Hello <strong>everyone</strong></p>')).toBe('Hello everyone')
  })

  it('is empty when the text is only blank lines', () => {
    expect(titleFromDetails('<p></p><p>   </p>')).toBe('')
  })

  it('cuts long text at a word and ends it with an ellipsis', () => {
    const title = titleFromDetails(`<p>${'word '.repeat(40)}</p>`)
    expect(title.length).toBeLessThanOrEqual(80)
    expect(title.endsWith('word…')).toBe(true)
  })

  it('never ends halfway through an emoji', () => {
    const title = titleFromDetails(`<p>${'a'.repeat(78)}🌱🌱 and more</p>`)
    expect(title.length).toBeLessThanOrEqual(80)
    expect(title).toBe(`${'a'.repeat(78)}…`)
  })
})

describe('isTitleOptional', () => {
  it('is true only for discussions', () => {
    expect(isTitleOptional('discussion')).toBe(true)
    expect(isTitleOptional('request')).toBe(false)
    expect(isTitleOptional('offer')).toBe(false)
  })
})
