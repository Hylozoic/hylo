import {
  GROUP_ASSISTANT_DEFAULTS,
  groupAssistantJsonSchema,
  sanitizeAssistantParts,
  sanitizeGroupAssistantSettings,
  validateGroupAssistantSettings
} from './GroupAssistantHelpers'

describe('group assistant settings', () => {
  it('starts off and reads nothing until a steward says so', () => {
    expect(sanitizeGroupAssistantSettings(undefined)).toEqual(GROUP_ASSISTANT_DEFAULTS)
    expect(GROUP_ASSISTANT_DEFAULTS.enabled).toBe(false)
    expect(GROUP_ASSISTANT_DEFAULTS.readableGroupIds).toEqual([])
    expect(GROUP_ASSISTANT_DEFAULTS.answerMembers).toBe(false)
  })

  it('keeps known fields of the right type and drops the rest', () => {
    const settings = sanitizeGroupAssistantSettings({
      enabled: true, followUps: 'yes', shareLoad: false, readableGroupIds: [7, '9', '9', 'x', -1, null], runsOn: 'elsewhere', extra: 1
    })
    expect(settings).toEqual({ ...GROUP_ASSISTANT_DEFAULTS, enabled: true, shareLoad: false, readableGroupIds: ['7', '9'] })
  })

  it('reports wrong values when a steward saves', () => {
    expect(validateGroupAssistantSettings(null).errors).toEqual(['settings must be an object'])
    expect(validateGroupAssistantSettings({ enabled: 'on' }).errors).toEqual(['enabled must be true or false'])
    expect(validateGroupAssistantSettings({ readableGroupIds: ['1; x'] }).errors).toEqual(['readableGroupIds must be ids'])
    expect(validateGroupAssistantSettings({ runsOn: 'members' }).errors[0]).toContain('runsOn must be one of')
    expect(validateGroupAssistantSettings({ enabled: true, readableGroupIds: [4] })).toEqual({
      settings: { ...GROUP_ASSISTANT_DEFAULTS, enabled: true, readableGroupIds: ['4'] }, errors: []
    })
  })
})

describe('assistant message parts', () => {
  const allowed = { postIds: ['11', '12'], groupIds: ['5'] }

  it('keeps known parts and trims them', () => {
    const { parts, dropped } = sanitizeAssistantParts([
      { type: 'counsel', steps: [{ title: ' Pause ', line: 'Give it a day.' }, { title: '', line: 'no title' }] },
      { type: 'bullets', items: ['One', '', 2, 'Two'] },
      { type: 'quotedPost', postId: 11 },
      { type: 'draft', text: ' Thanks for raising this. ', replyToPostId: '12', groupId: '', title: '' },
      { type: 'draft', text: 'Welcome all', title: 'Welcome', groupId: '5', replyToPostId: '' }
    ], allowed)
    expect(dropped).toBe(0)
    expect(parts).toEqual([
      { type: 'counsel', steps: [{ title: 'Pause', line: 'Give it a day.' }] },
      { type: 'bullets', items: ['One', 'Two'] },
      { type: 'quotedPost', postId: '11' },
      { type: 'draft', text: 'Thanks for raising this.', replyToPostId: '12' },
      { type: 'draft', text: 'Welcome all', title: 'Welcome', groupId: '5' }
    ])
  })

  it('drops anything that points outside what the assistant was given', () => {
    const { parts, dropped } = sanitizeAssistantParts([
      { type: 'quotedPost', postId: '99' },
      { type: 'draft', text: 'Hi', replyToPostId: '99' },
      { type: 'draft', text: 'Hi', groupId: '6', title: 'Elsewhere' },
      { type: 'draft', text: '', groupId: '5' },
      { type: 'proposal', changes: [{ setting: 'steward', value: true }] },
      { type: 'html', html: '<script>x</script>' },
      null
    ], allowed)
    expect(parts).toEqual([])
    expect(dropped).toBe(7)
    expect(sanitizeAssistantParts('nope').parts).toEqual([])
  })

  it('has a schema every part field is required in, so the model answers in one shape', () => {
    const schema = groupAssistantJsonSchema()
    expect(schema.required).toEqual(['text', 'parts'])
    const part = schema.properties.parts.items
    expect(part.required.sort()).toEqual(Object.keys(part.properties).sort())
    expect(part.additionalProperties).toBe(false)
  })
})
