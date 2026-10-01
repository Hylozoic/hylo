/* eslint-env jest */
import { toPlainText } from './ogText'

describe('toPlainText', () => {
  it('strips HTML tags', () => {
    expect(toPlainText('<p>Come help <strong>plant</strong> trees.</p>')).toBe('Come help plant trees.')
  })

  it('strips markdown emphasis', () => {
    expect(toPlainText('Coordinate **community** work.')).toBe('Coordinate community work.')
  })

  it('truncates long copy', () => {
    expect(toPlainText('abcdefghij', 6)).toBe('abcde…')
  })
})
