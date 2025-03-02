import 'react-native'
import React from 'react'
import ReactShallowRenderer from 'react-test-renderer/shallow'
import ReactTestRenderer from 'react-test-renderer'
import { MemberDetails, MemberSkills, MemberGroups, GroupRow } from './MemberDetails'
import { Provider } from 'react-redux'

import configureMockStore from 'redux-mock-store'

const mockStore = configureMockStore()

const store = mockStore({
})

// Ugly, but seems to be necessary to dodge issues with debounce and timers
// (see https://github.com/facebook/jest/issues/3465)
jest.unmock('lodash')
const lodash = jest.requireActual('lodash/fp')
lodash.debounce = (_, fn) => fn

jest.mock('@react-navigation/native', () => {
  const actualNav = jest.requireActual('@react-navigation/native')
  return {
    ...actualNav,
    useNavigation: () => ({
      navigate: jest.fn(),
      dispatch: jest.fn()
    })
  }
})

describe('MemberDetails', () => {
  const navigation = {
    setOptions: () => {},
    state: {}
  }
  const route = {
    name: 'MemberProfile'
  }

  it('matches the last snapshot', () => {
    const renderer = new ReactShallowRenderer()
    renderer.render(
      <Provider store={store}>
        <MemberDetails
          t={str => str}
          isFocused
          person={{ id: 1 }}
          goToGroup={() => {}}
          navigation={navigation}
          route={route}
        />
      </Provider>
    )
    const actual = renderer.getRenderOutput()

    expect(actual).toMatchSnapshot()
  })

  it("returns Loading when there's no person", () => {
    const renderer = new ReactShallowRenderer()
    renderer.render(
      <Provider store={store}>
        <MemberDetails
          t={str => str}
          isFocused
          navigation={navigation}
          route={route}
        />
      </Provider>
    )
    const actual = renderer.getRenderOutput()

    expect(actual).toMatchSnapshot()
  })

  describe('validate', () => {
    // it('returns true when name is present', () => {
    //   const props = {
    //     isFocused: true,
    //     person: {
    //       id: 1,
    //       name: 'don',
    //       location: 'here',
    //       tagline: 'rock',
    //       bio: 'stuff',
    //       omitable: 'should be omitted',
    //       skills: { toRefArray: jest.fn(() => []) },
    //       memberships: { toModelArray: jest.fn(() => []) }
    //     },
    //     fetchPerson: () => {},
    //     navigation,
    //     route
    //   }

    //   const instance = ReactTestRenderer.create(
    //     <MemberDetails {...props} />
    //   ).getInstance()
    //   instance.setState({
    //     person: { name: 'Sue' }
    //   })
    //   instance.validate()
    //   expect(instance.state.errors.name).toEqual(null)
    // })

    // it('returns false and sets error when name is empty', () => {
    //   const props = {
    //     isFocused: true,
    //     person: {
    //       id: 1,
    //       location: 'here',
    //       tagline: 'rock',
    //       bio: 'stuff',
    //       omitable: 'should be omitted',
    //       skills: { toRefArray: jest.fn(() => []) },
    //       memberships: { toModelArray: jest.fn(() => []) }
    //     },
    //     fetchPerson: () => {},
    //     navigation,
    //     route
    //   }

    //   const instance = ReactTestRenderer.create(
    //     <MemberDetails {...props} />
    //   ).getInstance()
    //   instance.setState({
    //     person: {
    //       id: 1,
    //       name: '',
    //       location: 'here',
    //       tagline: 'rock',
    //       bio: 'stuff',
    //       omitable: 'should be omitted',
    //       skills: { toRefArray: jest.fn(() => []) },
    //       memberships: { toModelArray: jest.fn(() => []) }
    //     }
    //   })
    //   instance.validate()
    //   expect(instance.state.errors.name).toEqual('Name must not consist solely of whitespace.')
    // })
  })

  describe('editProfile', () => {
    it('sets state.editing to true', () => {
      const props = {
        isFocused: true,
        person: {},
        fetchPerson: () => {},
        navigation,
        route
      }

      const instance = ReactTestRenderer.create(
        <MemberDetails {...props} t={str => str} />
      ).getInstance()
      instance.editProfile()
      expect(instance.state.editing).toEqual(true)
    })
  })

  describe('saveChanges', () => {
    // it('calls updateUserSettings', async () => {
    //   const props = {
    //     isFocused: true,
    //     person: {
    //       id: 1,
    //       name: 'don',
    //       location: 'here',
    //       tagline: 'rock',
    //       bio: 'stuff',
    //       omitable: 'should be omitted',
    //       skills: { toRefArray: jest.fn(() => []) },
    //       memberships: { toModelArray: jest.fn(() => []) }
    //     },
    //     fetchPerson: () => {},
    //     updateUserSettings: jest.fn(),
    //     navigation,
    //     route
    //   }

    //   const instance = ReactTestRenderer.create(
    //     <MemberDetails {...props} />
    //   ).getInstance()
    //   instance.setState({
    //     person: {
    //       name: 'joe',
    //       location: 'oakland'
    //     },
    //     editing: true
    //   })
    //   await instance.saveChanges()
    //   expect(instance.state.editing).toEqual(false)
    //   expect(props.updateUserSettings).toHaveBeenCalledWith(instance.state.person)
    // })

    //   it("returns false and doesn't call updateUserSettings when validate is false", () => {
    //     const props = {
    //       isFocused: true,
    //       person: {
    //         id: 1,
    //         name: 'don',
    //         location: 'here',
    //         tagline: 'rock',
    //         bio: 'stuff',
    //         omitable: 'should be omitted',
    //         skills: { toRefArray: jest.fn(() => []) },
    //         memberships: { toModelArray: jest.fn(() => []) }
    //       },
    //       fetchPerson: () => {},
    //       updateUserSettings: jest.fn(),
    //       navigation,
    //       route
    //     }

  //     const instance = ReactTestRenderer.create(
  //       <MemberDetails {...props} />
  //     ).getInstance()
  //     instance.setState({
  //       errors: {
  //         person: {}
  //       },
  //       editing: true
  //     })
  //     instance.saveChanges()
  //     expect(instance.state.editing).toEqual(true)
  //     expect(props.updateUserSettings).not.toHaveBeenCalled()
  //   })
  })
})

describe('MemberSkills', () => {
  it('matches the last snapshot', () => {
    const skills = [
      { id: 1, name: 'run' },
      { id: 2, name: 'all' },
      { id: 3, name: 'day' }
    ]

    const renderer = new ReactShallowRenderer()
    renderer.render(
      <Provider store={store}>
        <MemberSkills skills={skills} t={str => str} />
      </Provider>
    )
    const actual = renderer.getRenderOutput()

    expect(actual).toMatchSnapshot()
  })

  it('returns null when skills is empty', () => {
    const person = {
      skills: []
    }

    const renderer = new ReactShallowRenderer()
    renderer.render(
      <MemberSkills person={person} t={str => str} />
    )
    const actual = renderer.getRenderOutput()

    expect(actual).toBeNull()
  })
})

describe('MemberGroups', () => {
  it('matches the last snapshot', () => {
    const person = {
      memberships: [
        { id: 1 },
        { id: 2 },
        { id: 3 }
      ]
    }

    const renderer = new ReactShallowRenderer()
    renderer.render(
      <Provider store={store}>
        <MemberGroups person={person} t={str => str} />
      </Provider>
    )
    const actual = renderer.getRenderOutput()

    expect(actual).toMatchSnapshot()
  })

  // it('returns null when skills is empty', () => {
  //   const person = {
  //     memberships: []
  //   }

  //   const renderer = new ReactShallowRenderer()
  //   renderer.render(
  //     <Provider store={store}>
  //       <MemberGroups person={person} />
  //     </Provider>
  //   )
  //   const actual = renderer.getRenderOutput()

  //   expect(actual).toBeNull()
  // })
})

describe('GroupRow', () => {
  it('matches the last snapshot', () => {
    const membership = {
      group: {
        id: 23,
        name: 'Great Place',
        memberCount: 432
      },
      hasModeratorRole: false
    }

    const renderer = new ReactShallowRenderer()
    renderer.render(
      <Provider store={store}>
        <GroupRow membership={membership} />
      </Provider>
    )
    const actual = renderer.getRenderOutput()

    expect(actual).toMatchSnapshot()
  })

  it('handles high member count and moderator role', () => {
    const membership = {
      group: {
        id: 23,
        name: 'Greater Place',
        memberCount: 24495
      },
      hasModeratorRole: true
    }

    const renderer = new ReactShallowRenderer()
    renderer.render(
      <Provider store={store}>
        <GroupRow membership={membership} />
      </Provider>
    )
    const actual = renderer.getRenderOutput()

    expect(actual).toMatchSnapshot()
  })
})
