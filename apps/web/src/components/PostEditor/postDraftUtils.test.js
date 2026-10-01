/* eslint-env jest */
import { buildPostDraftPayload, mergeDraftIntoPost } from './postDraftUtils'
import { hasPostDraftPayloadContent } from 'hooks/useDraft'

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

describe('draft attachments', () => {
  it('keeps image and file urls through a save and restore', () => {
    const payload = buildPostDraftPayload({
      title: '',
      imageUrls: ['https://example.com/a.png', 'https://example.com/b.png'],
      fileUrls: ['https://example.com/report.pdf']
    })
    const restored = mergeDraftIntoPost({ title: '', groups: [] }, JSON.parse(JSON.stringify(payload)))

    expect(restored.imageUrls).toEqual(['https://example.com/a.png', 'https://example.com/b.png'])
    expect(restored.fileUrls).toEqual(['https://example.com/report.pdf'])
  })

  it('takes urls from a post\'s own attachments when no url lists are given', () => {
    const payload = buildPostDraftPayload({
      imageAttachments: [{ url: 'https://example.com/a.png', type: 'image' }],
      fileAttachments: []
    })

    expect(payload.imageUrls).toEqual(['https://example.com/a.png'])
    expect(payload.fileUrls).toEqual([])
  })

  it('counts attachments alone as draft content', () => {
    expect(hasPostDraftPayloadContent(buildPostDraftPayload({ imageUrls: ['https://example.com/a.png'] }))).toBe(true)
    expect(hasPostDraftPayloadContent(buildPostDraftPayload({}))).toBe(false)
  })
})
