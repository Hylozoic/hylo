import shouldLandOnWelcome from './shouldLandOnWelcome'

const welcomeGroup = {
  settings: {},
  groupViews: { items: [{ type: 'welcome' }, { type: 'all' }] }
}

it('sends a first-visit member to welcome when the view exists', () => {
  expect(shouldLandOnWelcome(welcomeGroup, { lastViewedAt: null })).toBe(true)
})

it('skips welcome after the member has already viewed the group', () => {
  expect(shouldLandOnWelcome(welcomeGroup, { lastViewedAt: '2026-01-01T00:00:00.000Z' })).toBe(false)
})

it('skips welcome when show-to-new-members is off', () => {
  expect(shouldLandOnWelcome(
    { ...welcomeGroup, settings: { showWelcomePage: false } },
    { lastViewedAt: null }
  )).toBe(false)
})

it('skips welcome when there is no welcome view', () => {
  expect(shouldLandOnWelcome(
    { settings: { showWelcomePage: true }, groupViews: { items: [{ type: 'all' }] } },
    { lastViewedAt: null }
  )).toBe(false)
})

it('skips welcome when already on the welcome path', () => {
  expect(shouldLandOnWelcome(welcomeGroup, { lastViewedAt: null }, { onWelcomePath: true })).toBe(false)
})
