/* eslint-env jest */
import { shouldSkipExternalEditorContent } from './HyloEditor'

describe('shouldSkipExternalEditorContent', () => {
  it('skips when the incoming HTML already matches the editor', () => {
    expect(shouldSkipExternalEditorContent('<p>hi</p>', '<p>hi</p>', false)).toBe(true)
  })

  it('skips empty-to-empty updates so setContent does not jump the caret', () => {
    expect(shouldSkipExternalEditorContent('<p></p>', '', false)).toBe(true)
    expect(shouldSkipExternalEditorContent('', '<p></p>', true)).toBe(true)
  })

  it('skips wiping a focused next message when a send/reset pushes empty HTML', () => {
    expect(shouldSkipExternalEditorContent('<p>ab</p>', '', true)).toBe(true)
  })

  it('applies a draft or room switch when the editor is empty', () => {
    expect(shouldSkipExternalEditorContent('<p></p>', '<p>draft</p>', false)).toBe(false)
  })

  it('applies an empty reset when the editor is not focused', () => {
    expect(shouldSkipExternalEditorContent('<p>stale</p>', '', false)).toBe(false)
  })
})
