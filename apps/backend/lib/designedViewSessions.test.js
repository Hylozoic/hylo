import {
  designMessageAuthorIds, normalizeDesignSessionDraft, normalizeStoredDesignMessages, presentDesignSession, MAX_STORED_DESIGN_MESSAGES
} from './designedViewSessions'

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

    it('says which steward asked each question: a steward already in the conversation, or whoever is storing it', () => {
      const stored = normalizeStoredDesignMessages([
        { role: 'user', text: 'Mine', userId: '7' },
        { role: 'assistant', text: 'Done', userId: '7' },
        { role: 'user', text: 'Theirs', userId: 9 },
        { role: 'user', text: 'Pretending', userId: '42' },
        { role: 'user', text: 'Odd', userId: 'x; drop' },
        { role: 'user', text: 'New' }
      ], { userId: 9, knownUserIds: ['7'] })
      expect(stored).to.deep.equal([
        { role: 'user', text: 'Mine', userId: '7' },
        { role: 'assistant', text: 'Done' },
        { role: 'user', text: 'Theirs', userId: '9' },
        { role: 'user', text: 'Pretending', userId: '9' },
        { role: 'user', text: 'Odd', userId: '9' },
        { role: 'user', text: 'New', userId: '9' }
      ])
      expect(designMessageAuthorIds(stored)).to.deep.equal(['7', '9'])
      expect(designMessageAuthorIds(null)).to.deep.equal([])
    })
  })

  describe('presentDesignSession', () => {
    it('returns what the designer needs, with the version to send back', () => {
      expect(presentDesignSession(null)).to.equal(null)
      const updatedAt = new Date()
      expect(presentDesignSession({ messages: [], draft: null, version: 3, updated_at: updatedAt, updated_by_id: 9 }, [{ id: '9', name: 'Sam' }]))
        .to.deep.equal({ messages: [], draft: null, version: 3, updatedAt, updatedById: '9', authors: [{ id: '9', name: 'Sam' }] })
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
