/* eslint-env jest */
import { mergeDraftIntoPost } from './postDraftUtils'

describe('mergeDraftIntoPost', () => {
  const existingPreview = {
    id: 'lp-1',
    title: 'Existing preview',
    url: 'https://example.com'
  }

  const base = {
    id: '1',
    title: 'Original title',
    details: 'Original details',
    groups: [{ id: 'g1' }],
    linkPreview: existingPreview,
    linkPreviewFeatured: true
  }

  it('keeps the post link preview when a draft has none', () => {
    const result = mergeDraftIntoPost(base, {
      title: 'Edited title',
      linkPreview: null,
      linkPreviewFeatured: false
    })

    expect(result.title).toBe('Edited title')
    expect(result.linkPreview).toEqual(existingPreview)
    expect(result.linkPreviewFeatured).toBe(true)
  })

  it('uses a draft link preview when the user added one', () => {
    const draftPreview = { id: 'lp-2', title: 'New preview', url: 'https://other.com' }
    const result = mergeDraftIntoPost(base, {
      linkPreview: draftPreview,
      linkPreviewFeatured: false
    })

    expect(result.linkPreview).toEqual(draftPreview)
    expect(result.linkPreviewFeatured).toBe(false)
  })

  it('clears the preview when the user removed it', () => {
    const result = mergeDraftIntoPost(base, {
      skipLinkPreview: true,
      linkPreview: null,
      linkPreviewFeatured: false
    })

    expect(result.linkPreview).toBe(null)
    expect(result.linkPreviewFeatured).toBe(false)
  })
})
