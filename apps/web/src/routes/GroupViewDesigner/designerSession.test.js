import {
  addDesignPost,
  addDesignDocument,
  fileNameFromUrl,
  nameAfterTurn,
  EMPTY_USAGE_TOTAL,
  addDesignImage,
  addDesignUsage,
  imagesFromUrls,
  designerSessionKey,
  getDesignerSession,
  resetDesignerSession,
  updateDesignerSession,
  messagesForModel,
  MAX_MESSAGES_FOR_MODEL,
  restoreDesignerSession,
  storedDesignerSession,
  authorsById
} from './designerSession'
import { storeDesignerSession } from './storeDesignerSession'
import { DELETE_GROUP_VIEW_DESIGN_SESSION, deleteGroupViewDesignSession, fetchGroupViewDesignSession, saveGroupViewDesignSession } from 'store/actions/groupViewDesignSession'
import designGroupViewTurn, { DESIGN_GROUP_VIEW_TURN } from 'store/actions/designGroupViewTurn'
import { designStatus } from './EditableViewName'
import fetchDesignedViewBlockData from 'store/actions/fetchDesignedViewBlockData'
import suggestGroupViews, { SUGGEST_GROUP_VIEWS } from 'store/actions/suggestGroupViews'

describe('designerSession', () => {
  const key = designerSessionKey('7', 'new')
  afterEach(() => resetDesignerSession(key))

  it('keeps one session per group and view, and starts empty', () => {
    expect(getDesignerSession(key)).toMatchObject({ messages: [], design: null, name: '', dirty: false, loaded: false })
    updateDesignerSession(key, { name: 'Welcome' })
    updateDesignerSession(key, current => ({ messages: [...current.messages, { role: 'user', text: 'Hi' }] }))
    expect(getDesignerSession(key)).toMatchObject({ name: 'Welcome', messages: [{ role: 'user', text: 'Hi' }] })
    expect(getDesignerSession(designerSessionKey('7', '12')).name).toEqual('')
  })

  it('forgets a session when reset', () => {
    updateDesignerSession(key, { name: 'Welcome' })
    resetDesignerSession(key)
    expect(getDesignerSession(key).name).toEqual('')
  })

  it('adds up usage, and stops claiming a total cost once one is unknown', () => {
    const one = addDesignUsage(EMPTY_USAGE_TOTAL, { inputTokens: 4000, outputTokens: 500, estimatedCostUsd: 0.026 })
    expect(one).toEqual({ count: 1, tokens: 4500, costUsd: 0.026, costKnown: true })
    expect(addDesignUsage(one, { inputTokens: 10, outputTokens: 1, estimatedCostUsd: null }).costKnown).toBe(false)
  })
})

describe('designStatus', () => {
  it('is a draft until saved, then published, with unsaved changes in between', () => {
    expect(designStatus({ isNew: true, session: { dirty: true } })).toEqual('draft')
    expect(designStatus({ isNew: true, session: { dirty: false } })).toEqual('draft')
    expect(designStatus({ isNew: false, session: { dirty: false, nameEdited: false } })).toEqual('published')
    expect(designStatus({ isNew: false, session: { dirty: true } })).toEqual('unsaved')
    expect(designStatus({ isNew: false, session: { dirty: false, nameEdited: true } })).toEqual('unsaved')
  })
})

describe('nameAfterTurn', () => {
  it('takes the suggested name only when the steward has none of their own', () => {
    expect(nameAfterTurn({ name: '', nameEdited: false }, ' Garden at a Glance ')).toEqual('Garden at a Glance')
    expect(nameAfterTurn({ name: 'Start Here', nameEdited: false }, 'Something else')).toEqual('Start Here')
    expect(nameAfterTurn({ name: 'Mine', nameEdited: true }, 'Something else')).toEqual('Mine')
    expect(nameAfterTurn({ name: '', nameEdited: false }, undefined)).toEqual('')
  })
})

describe('design images', () => {
  it('names images by position and does not list one twice', () => {
    const one = addDesignImage([], 'https://uploads.example.org/a.jpg')
    const two = addDesignImage(one, 'https://uploads.example.org/b.jpg')
    expect(two).toEqual([
      { url: 'https://uploads.example.org/a.jpg', name: 'Image 1' },
      { url: 'https://uploads.example.org/b.jpg', name: 'Image 2' }
    ])
    expect(addDesignImage(two, 'https://uploads.example.org/a.jpg')).toBe(two)
    expect(addDesignImage(two, '')).toBe(two)
    expect(imagesFromUrls(['https://uploads.example.org/a.jpg', 'https://uploads.example.org/a.jpg'])).toEqual(one)
  })
})

describe('design documents', () => {
  const flyer = 'https://uploads.example.org/evo-uploads/group/7/Spring%20Flyer.pdf'

  it('lists PDFs by file name, once each, up to three', () => {
    const one = addDesignDocument([], flyer)
    expect(one).toEqual([{ url: flyer, name: 'Spring Flyer.pdf' }])
    expect(addDesignDocument(one, flyer)).toBe(one)
    expect(addDesignDocument(one, 'https://uploads.example.org/notes.docx')).toBe(one)
    const full = ['a', 'b', 'c'].reduce((list, name) => addDesignDocument(list, `https://uploads.example.org/${name}.pdf`), [])
    expect(full).toHaveLength(3)
    expect(addDesignDocument(full, 'https://uploads.example.org/d.pdf')).toBe(full)
    expect(fileNameFromUrl('not a url')).toEqual('')
  })
})

describe('picked posts', () => {
  it('lists posts once each, up to six', () => {
    const one = addDesignPost([], { id: 482, title: 'Seed swap', type: 'event', details: 'not kept' })
    expect(one).toEqual([{ id: '482', title: 'Seed swap', type: 'event' }])
    expect(addDesignPost(one, { id: '482' })).toBe(one)
    expect(addDesignPost(one, null)).toBe(one)
    const full = [1, 2, 3, 4, 5, 6].reduce((list, id) => addDesignPost(list, { id }), [])
    expect(addDesignPost(full, { id: 7 })).toBe(full)
  })
})

describe('designGroupViewTurn', () => {
  it('sends the conversation and the current design to the mutation', () => {
    const messages = [{ role: 'user', text: 'A welcome page' }]
    const action = designGroupViewTurn('7', messages, { blocks: [] })
    expect(action.type).toEqual(DESIGN_GROUP_VIEW_TURN)
    expect(action.graphql.query).toContain('designGroupViewTurn(groupId: $groupId, messages: $messages, currentView: $currentView, images: $images, documents: $documents, postIds: $postIds)')
    expect(action.graphql.variables).toEqual({ groupId: '7', messages, currentView: { blocks: [] }, images: [], documents: [], postIds: [] })
    expect(designGroupViewTurn('7', messages, null, [], [], ['482']).graphql.variables.postIds).toEqual(['482'])
    const documents = [{ url: 'https://uploads.example.org/flyer.pdf', name: 'flyer.pdf' }]
    expect(designGroupViewTurn('7', messages, null, [], documents).graphql.variables.documents).toEqual(documents)
    const images = [{ url: 'https://uploads.example.org/a.jpg', name: 'Image 1' }]
    expect(designGroupViewTurn('7', messages, null, images).graphql.variables.images).toEqual(images)
  })
})

describe('suggestGroupViews', () => {
  it('asks for suggestions for a group', () => {
    const action = suggestGroupViews('7')
    expect(action.type).toEqual(SUGGEST_GROUP_VIEWS)
    expect(action.graphql.query).toContain('suggestGroupViews(groupId: $groupId)')
    expect(action.graphql.variables).toEqual({ groupId: '7' })
  })
})

describe('fetchDesignedViewBlockData', () => {
  it('asks for the newest posts of the chosen types', () => {
    const { graphql } = fetchDesignedViewBlockData('garden', { type: 'posts', postTypes: ['offer'], limit: 4 })
    expect(graphql.variables).toEqual({ slug: 'garden', first: 4, types: ['offer'], search: null })
    expect(fetchDesignedViewBlockData('garden', { type: 'posts', postTypes: [], search: 'compost', limit: 4 }).graphql.variables.search).toEqual('compost')
    expect(graphql.query).toContain('sortBy: "created"')
  })

  it('asks for every standalone post type when none is chosen', () => {
    const { graphql } = fetchDesignedViewBlockData('garden', { type: 'posts', postTypes: [], limit: 4 })
    expect(graphql.variables.types).toContain('discussion')
    expect(graphql.variables.types).not.toContain('chat')
  })

  it('asks for upcoming events in date order, and for members', () => {
    const events = fetchDesignedViewBlockData('garden', { type: 'events', limit: 3 }).graphql
    expect(events.query).toContain('sortBy: "start_time", order: "asc"')
    expect(new Date(events.variables.afterTime).getTime()).toBeLessThanOrEqual(Date.now())

    const members = fetchDesignedViewBlockData('garden', { type: 'members', limit: 8 }).graphql
    expect(members.query).toContain('members(first: $first)')
    expect(members.variables).toEqual({ slug: 'garden', first: 8 })
  })
})

describe('stored designer sessions', () => {
  const design = { version: 1, blocks: [{ type: 'heading', text: 'Hi', level: 1 }] }
  const savedDesign = { version: 1, blocks: [{ type: 'divider' }] }
  const messages = [{ role: 'user', text: 'A page' }, { role: 'assistant', text: 'Done' }]

  it('stores the conversation and the page with what was added for it, not the transient state', () => {
    const session = {
      ...getDesignerSession('stored:1'),
      messages,
      design,
      name: 'Welcome',
      dirty: true,
      sending: true,
      error: 'x',
      posts: [{ id: '3', title: 'Potluck', type: 'event' }]
    }
    const stored = storedDesignerSession(session)
    expect(stored.messages).toEqual(messages)
    expect(Object.keys(stored.draft).sort()).toEqual(['design', 'dirty', 'documents', 'images', 'name', 'nameEdited', 'posts', 'suggestions', 'usageTotal'])
    expect(stored.draft).toMatchObject({ design, name: 'Welcome', dirty: true, posts: [{ id: '3', title: 'Potluck', type: 'event' }] })
    resetDesignerSession('stored:1')
  })

  it('restores a new page from what was stored, and starts empty without it', () => {
    expect(restoreDesignerSession({}, null)).toMatchObject({ messages: [], design: null, name: '', dirty: false, usageTotal: EMPTY_USAGE_TOTAL })
    const restored = restoreDesignerSession({}, { messages, draft: { design, name: 'Suggested', nameEdited: false, dirty: true, images: [], posts: [] } })
    expect(restored).toMatchObject({ messages, design, name: 'Suggested', dirty: true })
  })

  it('opens a saved view on its saved page unless the stored page was changed, and keeps the conversation', () => {
    const saved = { design: savedDesign, name: 'Start here', images: [] }
    const afterSave = restoreDesignerSession(saved, { messages, draft: null })
    expect(afterSave).toMatchObject({ messages, design: savedDesign, name: 'Start here', dirty: false })

    const unchanged = restoreDesignerSession(saved, { messages, draft: { design, name: 'Old', nameEdited: false, dirty: false } })
    expect(unchanged).toMatchObject({ design: savedDesign, name: 'Start here', dirty: false })

    const changed = restoreDesignerSession(saved, { messages, draft: { design, name: 'Mine', nameEdited: true, dirty: true, images: [{ url: 'https://x.org/a.jpg', name: 'Image 1' }] } })
    expect(changed).toMatchObject({ design, name: 'Mine', nameEdited: true, dirty: true, images: [{ url: 'https://x.org/a.jpg', name: 'Image 1' }] })
  })

  it('sends the model only the newest messages of a long conversation', () => {
    const long = Array.from({ length: MAX_MESSAGES_FOR_MODEL + 3 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', text: String(i) }))
    const sent = messagesForModel(long)
    expect(sent).toHaveLength(MAX_MESSAGES_FOR_MODEL)
    expect(sent[sent.length - 1]).toEqual(long[long.length - 1])
    expect(messagesForModel(messages)).toEqual(messages)
  })

  it('builds the session queries for a saved view or the page not added yet', () => {
    expect(fetchGroupViewDesignSession('5').graphql.variables).toEqual({ groupId: '5', viewId: null })
    expect(saveGroupViewDesignSession('5', '9', messages, null, 3).graphql.variables).toEqual({ groupId: '5', viewId: '9', messages, draft: null, version: 3 })
    const remove = deleteGroupViewDesignSession('5', null, 2)
    expect(remove.type).toEqual(DELETE_GROUP_VIEW_DESIGN_SESSION)
    expect(remove.graphql.query).toContain('deleteGroupViewDesignSession(groupId: $groupId, viewId: $viewId, version: $version)')
    expect(remove.graphql.variables).toEqual({ groupId: '5', viewId: null, version: 2 })
  })

  it('restores the version to send back and who asked each question, from the shared session', () => {
    const authors = [{ id: '4', name: 'Sam', avatarUrl: 'https://x.org/sam.png' }, { name: 'no id' }]
    expect(authorsById(authors)).toEqual({ 4: authors[0] })
    expect(authorsById(null)).toEqual({})
    const restored = restoreDesignerSession({}, { messages: [{ role: 'user', text: 'Hi', userId: '4' }], draft: null, version: 5, authors })
    expect(restored).toMatchObject({ version: 5, authors: { 4: authors[0] } })
    expect(restoreDesignerSession({}, null)).toMatchObject({ version: null, authors: {} })
  })

  describe('storeDesignerSession', () => {
    const storeKey = designerSessionKey('7', '9')
    const stored = { messages, draft: null }
    afterEach(() => resetDesignerSession(storeKey))

    it('sends the version it last saw, one store at a time, and keeps the new version', async () => {
      updateDesignerSession(storeKey, { version: 2, loaded: true })
      const sent = []
      const dispatch = jest.fn(async action => {
        if (action.type === 'SAVE_GROUP_VIEW_DESIGN_SESSION') {
          sent.push(action.graphql.variables.version)
          return { payload: { data: { saveGroupViewDesignSession: { version: action.graphql.variables.version + 1, authors: [{ id: '4', name: 'Sam' }] } } } }
        }
        return {}
      })
      await Promise.all([
        storeDesignerSession(dispatch, storeKey, '7', '9', stored),
        storeDesignerSession(dispatch, storeKey, '7', '9', stored)
      ])
      expect(sent).toEqual([2, 3])
      expect(getDesignerSession(storeKey)).toMatchObject({ version: 4, authors: { 4: { id: '4', name: 'Sam' } }, storedSnapshot: JSON.stringify(stored) })
    })

    it('loads the session again when another steward changed it', async () => {
      updateDesignerSession(storeKey, { version: 2, loaded: true, sending: true })
      const changed = Object.assign(new Error('Another steward changed this design.'), { extensions: { code: 'DESIGN_SESSION_CHANGED' } })
      const dispatch = jest.fn(async action => action.type === 'SAVE_GROUP_VIEW_DESIGN_SESSION' ? { error: true, payload: changed } : {})
      await expect(storeDesignerSession(dispatch, storeKey, '7', '9', stored)).rejects.toBe(changed)
      expect(getDesignerSession(storeKey)).toMatchObject({ loaded: false, sending: false, changedByOther: true })
      expect(dispatch.mock.calls.map(([action]) => action.type)).toContain('FETCH_GROUP_VIEWS')
    })
  })
})
