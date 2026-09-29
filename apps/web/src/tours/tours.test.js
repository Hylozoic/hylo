import { tourCatalog, isTourAvailable } from './catalog'
import { GLOBAL_CHROME_TOUR_ID, globalChromeTourSteps } from './globalChromeTour'
import { GROUP_CREATOR_TOUR_ID, GROUP_WELCOME_TOUR_ID, groupCreatorTourSteps, groupWelcomeTourSteps } from './groupTours'
import { TOUR_LAYOUT_GRID, TOUR_LAYOUT_TABS, activeTourLayouts, resolveTourSteps } from './layouts'
import { presentTourSteps } from './useTour'

jest.mock('driver.js', () => ({ driver: jest.fn() }))

const t = (key) => key

// jsdom lays nothing out, so give each anchor a real on-screen box
function anchor (name, { empty = false } = {}) {
  const el = document.createElement(name === 'group-invite' ? 'span' : 'div')
  el.setAttribute('data-tour', name)
  if (!empty) {
    el.textContent = name
    el.getBoundingClientRect = () => ({ left: 10, right: 110, top: 10, bottom: 40, width: 100, height: 30, x: 10, y: 10 })
  }
  return el
}

function mountSurface ({ layout, anchors, emptyAnchors = [] }) {
  const root = document.createElement('div')
  if (layout) root.setAttribute('data-tour-layout', layout)
  anchors.forEach(name => root.appendChild(anchor(name)))
  emptyAnchors.forEach(name => root.appendChild(anchor(name, { empty: true })))
  document.body.appendChild(root)
  return root
}

const SIDE_RAIL = ['my-home', 'activity', 'messages', 'the-commons', 'create', 'help']
const GROUP_MENU = ['group-menu', 'group-notifications', 'group-about', 'edit-menu', 'group-settings']

const tourById = id => tourCatalog(t).find(tour => tour.id === id)
const elementsOf = steps => steps.map(step => step.element)

beforeEach(() => {
  document.body.innerHTML = ''
  document.elementFromPoint = () => null
})

describe('resolveTourSteps', () => {
  const steps = [
    { element: '#a', popover: { title: 'A', side: 'right' }, variants: { [TOUR_LAYOUT_TABS]: { popover: { side: 'bottom' } } } },
    { element: '#b', popover: { title: 'B', description: 'side', side: 'right' }, variants: { [TOUR_LAYOUT_GRID]: { popover: { description: 'grid' } } } },
    { element: '#c', popover: { title: 'C' } }
  ]

  it('keeps the sidebar version when no layout is marked', () => {
    const resolved = resolveTourSteps(steps, new Set())
    expect(resolved.map(step => step.popover.side)).toEqual(['right', 'right', undefined])
    expect(resolved[1].popover.description).toBe('side')
    expect(resolved.every(step => !step.variants)).toBe(true)
  })

  it('applies only the variants for the layouts on screen', () => {
    const resolved = resolveTourSteps(steps, new Set([TOUR_LAYOUT_TABS]))
    expect(resolved[0].popover).toEqual({ title: 'A', side: 'bottom' })
    expect(resolved[1].popover.description).toBe('side')

    const grid = resolveTourSteps(steps, new Set([TOUR_LAYOUT_GRID]))
    expect(grid[0].popover.side).toBe('right')
    expect(grid[1].popover).toEqual({ title: 'B', description: 'grid', side: 'right' })
  })

  it('reads the layouts from data-tour-layout markers', () => {
    mountSurface({ layout: TOUR_LAYOUT_TABS, anchors: [] })
    mountSurface({ layout: TOUR_LAYOUT_GRID, anchors: [] })
    expect(activeTourLayouts()).toEqual(new Set([TOUR_LAYOUT_TABS, TOUR_LAYOUT_GRID]))
  })
})

describe('global navigation tour', () => {
  it('runs on the side rail with popovers to the right', () => {
    mountSurface({ anchors: SIDE_RAIL })
    expect(isTourAvailable(tourById(GLOBAL_CHROME_TOUR_ID))).toBe(true)
    const steps = presentTourSteps(globalChromeTourSteps(t))
    expect(steps).toHaveLength(6)
    expect(steps.every(step => step.popover.side === 'right')).toBe(true)
  })

  it('runs in the top-bar layout with popovers below the bar', () => {
    mountSurface({ layout: TOUR_LAYOUT_TABS, anchors: SIDE_RAIL })
    expect(isTourAvailable(tourById(GLOBAL_CHROME_TOUR_ID))).toBe(true)
    const steps = presentTourSteps(globalChromeTourSteps(t))
    expect(elementsOf(steps)).toEqual(SIDE_RAIL.map(name => `[data-tour="${name}"]`))
    expect(steps.every(step => step.popover.side === 'bottom')).toBe(true)
    expect(steps.find(step => step.element === '[data-tour="help"]').popover.align).toBe('end')
  })

  it('is unavailable when no navigation is on screen', () => {
    mountSurface({ anchors: [] })
    expect(isTourAvailable(tourById(GLOBAL_CHROME_TOUR_ID))).toBe(false)
  })
})

describe('group tours', () => {
  it('run in the sidebar layout', () => {
    mountSurface({ anchors: [...GROUP_MENU, 'group-invite', 'new-post'] })
    expect(isTourAvailable(tourById(GROUP_WELCOME_TOUR_ID))).toBe(true)
    expect(isTourAvailable(tourById(GROUP_CREATOR_TOUR_ID))).toBe(true)
    const steps = presentTourSteps(groupWelcomeTourSteps(t))
    expect(steps[0].popover.side).toBe('right')
    expect(steps[0].popover.description).toBe('Each item is a view of this group. Spaces are sub-groups with their own members and content.')
  })

  it('run in the card-menu layout with card wording and popovers under the banner', () => {
    mountSurface({ layout: TOUR_LAYOUT_GRID, anchors: [...GROUP_MENU, 'group-invite'] })
    expect(isTourAvailable(tourById(GROUP_WELCOME_TOUR_ID))).toBe(true)
    expect(isTourAvailable(tourById(GROUP_CREATOR_TOUR_ID))).toBe(true)

    const welcome = presentTourSteps(groupWelcomeTourSteps(t))
    expect(elementsOf(welcome)).toEqual([
      '[data-tour="group-menu"]',
      '[data-tour="group-notifications"]',
      '[data-tour="group-about"]',
      '[data-tour="group-invite"]'
    ])
    expect(welcome[0].popover.description).toBe('Each card is a view of this group. Spaces are sub-groups with their own members and content.')
    expect(welcome.slice(1).every(step => step.popover.side === 'bottom')).toBe(true)

    const creator = presentTourSteps(groupCreatorTourSteps(t))
    expect(elementsOf(creator)).toEqual([
      '[data-tour="group-menu"]',
      '[data-tour="group-invite"]',
      '[data-tour="edit-menu"]',
      '[data-tour="group-settings"]'
    ])
    expect(creator[2].popover.description).toBe('Add views and spaces and drag the cards to reorder them. The first card is what members see first.')
  })
})

describe('member welcome tour invite step', () => {
  const INVITE = '[data-tour="group-invite"]'

  it('is part of the member tour', () => {
    const step = groupWelcomeTourSteps(t).find(step => step.element === INVITE)
    expect(step.popover.title).toBe('Bring people in')
    expect(step.popover.description).toBe('Know someone who belongs here? Invite them to join the group.')
  })

  it('shows for members who can invite (the invite control renders)', () => {
    mountSurface({ anchors: [...GROUP_MENU, 'group-invite'] })
    expect(elementsOf(presentTourSteps(groupWelcomeTourSteps(t)))).toContain(INVITE)
  })

  it('is skipped when the invite control renders nothing', () => {
    mountSurface({ anchors: GROUP_MENU, emptyAnchors: ['group-invite'] })
    const steps = presentTourSteps(groupWelcomeTourSteps(t))
    expect(elementsOf(steps)).not.toContain(INVITE)
    expect(steps.length).toBeGreaterThan(0)
  })

  it('is skipped when there is no invite anchor at all', () => {
    mountSurface({ layout: TOUR_LAYOUT_GRID, anchors: GROUP_MENU })
    expect(elementsOf(presentTourSteps(groupWelcomeTourSteps(t)))).not.toContain(INVITE)
  })
})
