import 'react-native'
import React from 'react'
import ReactShallowRenderer from 'react-test-renderer/shallow'
import TestRenderer from 'react-test-renderer'
import DrawerMenuLegacy, { SectionHeader, NetworkRow, GroupRow, TextButton } from './DrawerMenu'
import { ALL_GROUP } from 'store/models/Group'
import { TestRoot } from 'util/testing'

// jest.mock('react-native', () => ({
//   ...jest.requireActual('react-native'),
//   BackHandler: { addEventListener: jest.fn(), mockOnBackPress: jest.fn() }
// }))

describe('DrawerMenuLegacy', () => {
  const minProps = {
    name: 'Roy Rogers',
    avatarUrl: 'http://anyurl',
    memberships: [],
    goToGroup: () => {},
    goToMyProfile: () => {},
    showSettings: () => {},
    currentGroupId: 12,
    networks: [],
    goToGroupSettings: jest.fn(),
    currentGroup: { name: 'foo', avatarUrl: 'someurl' },
    groups: []
  }

  it('matches the last snapshot', () => {
    const props = {
      networks: [{
        id: 1,
        name: 'Network'
      }],
      groups: [{
        id: 2,
        name: 'Group'
      }]
    }
    const renderer = new ReactShallowRenderer()
    // const { toJSON } = TestRenderer.create(
    renderer.render(
      <TestRoot>
        <DrawerMenuLegacy {...minProps} {...props} />
      </TestRoot>
    )

    // expect(toJSON()).toMatchSnapshot()
    expect(renderer.getRenderOutput()).toMatchSnapshot()
  })
})

describe('SectionHeader', () => {
  it('matches the last snapshot', () => {
    const renderer = new ReactShallowRenderer()
    renderer.render(<SectionHeader section={{ label: 'Networked Groups' }} />)
    const actual = renderer.getRenderOutput()

    expect(actual).toMatchSnapshot()
  })
})

describe('GroupRow', () => {
  it('matches the last snapshot', () => {
    const renderer = new ReactShallowRenderer()
    const group = {
      id: 1,
      avatarUrl: 'foo.png',
      name: 'Foom',
      newPostCount: 7
    }
    renderer.render(<GroupRow
      group={group}
      goToGroup={() => {}}
      currentGroupId={2}
                    />)
    const actual = renderer.getRenderOutput()

    expect(actual).toMatchSnapshot()
  })

  it('hides badge when no newPostCount', () => {
    const renderer = new ReactShallowRenderer()
    const group = {
      id: 1,
      avatarUrl: 'foo.png',
      name: 'Foom'
    }
    renderer.render(<GroupRow
      group={group}
      goToGroup={() => {}}
      currentGroupId={2}
                    />)
    const actual = renderer.getRenderOutput()

    expect(actual).toMatchSnapshot()
  })

  it('highlights when matching currentGroupId', () => {
    const renderer = new ReactShallowRenderer()
    const group = {
      id: 1,
      avatarUrl: 'foo.png',
      name: 'Foom'
    }
    renderer.render(<GroupRow
      group={group}
      goToGroup={() => {}}
      currentGroupId={group.id}
                    />)
    const actual = renderer.getRenderOutput()

    expect(actual).toMatchSnapshot()
  })
})

it('TextButton renders', () => {
  const renderer = new ReactShallowRenderer()
  renderer.render(<TextButton text='anything' onPress={() => {}} />)
  const actual = renderer.getRenderOutput()

  expect(actual).toMatchSnapshot()
})
