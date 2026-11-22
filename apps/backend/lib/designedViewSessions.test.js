import { normalizeDesignSessionDraft, normalizeStoredDesignMessages, MAX_STORED_DESIGN_MESSAGES } from './designedViewSessions'

describe('designedViewSessions', () => {
  describe('normalizeStoredDesignMessages', () => {
    it('keeps user and assistant messages with text, newest last, up to the limit', () => {
      expect(normalizeStoredDesignMessages(null)).to.deep.equal([])
      expect(normalizeStoredDesignMessages([
        { role: 'user', text: 'Hi', extra: 1 }, { role: 'system', text: 'no' }, { role: 'assistant', text: '  ' }, { role: 'assistant', text: 'Done' }
      ])).to.deep.equal([{ role: 'user', text: 'Hi' }, { role: 'assistant', text: 'Done' }])
      const many = Array.from({ length: MAX_STORED_DESIGN_MESSAGES + 5 }, (_, i) => ({ role: 'user', text: String(i) }))
      const kept = normalizeStoredDesignMessages(many)
      expect(kept).to.have.length(MAX_STORED_DESIGN_MESSAGES)
      expect(kept[kept.length - 1].text).to.equal(String(MAX_STORED_DESIGN_MESSAGES + 4))
    })
  })

  describe('normalizeDesignSessionDraft', () => {
    it('returns null for nothing, and drops an invalid design and bad lists instead of refusing', () => {
      expect(normalizeDesignSessionDraft(null)).to.equal(null)
      expect(normalizeDesignSessionDraft([])).to.equal(null)
      const draft = normalizeDesignSessionDraft({
        design: { blocks: [{ type: 'html' }] },
        images: [{ url: 'http://not-https.example.org/a.jpg' }],
        posts: [{ id: 'abc' }, { id: 7, title: 'Seven' }],
        suggestions: { reply: 'Ideas', items: [{ name: 'A', why: 'B', prompt: 'C' }, { name: 1 }] },
        usageTotal: { count: -1, tokens: 'x', costUsd: 0.5 }
      })
      expect(draft.design).to.equal(null)
      expect(draft.images).to.deep.equal([])
      expect(draft.posts).to.deep.equal([{ id: '7', title: 'Seven', type: '' }])
      expect(draft.suggestions).to.deep.equal({ reply: 'Ideas', items: [{ name: 'A', why: 'B', prompt: 'C' }] })
      expect(draft.usageTotal).to.deep.equal({ count: 0, tokens: 0, costUsd: 0.5, costKnown: true })
      expect(draft.dirty).to.equal(false)
    })
  })
})
