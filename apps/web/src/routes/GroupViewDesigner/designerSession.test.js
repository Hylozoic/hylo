import {
  nameAfterTurn,
  EMPTY_USAGE_TOTAL,
  addDesignImage,
  addDesignUsage,
  imagesFromUrls,
  designerSessionKey,
  getDesignerSession,
  resetDesignerSession,
  updateDesignerSession
} from './designerSession'
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

describe('designGroupViewTurn', () => {
  it('sends the conversation and the current design to the mutation', () => {
    const messages = [{ role: 'user', text: 'A welcome page' }]
    const action = designGroupViewTurn('7', messages, { blocks: [] })
    expect(action.type).toEqual(DESIGN_GROUP_VIEW_TURN)
    expect(action.graphql.query).toContain('designGroupViewTurn(groupId: $groupId, messages: $messages, currentView: $currentView, images: $images)')
    expect(action.graphql.variables).toEqual({ groupId: '7', messages, currentView: { blocks: [] }, images: [] })
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
