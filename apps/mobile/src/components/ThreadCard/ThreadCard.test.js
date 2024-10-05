import React from 'react'
import ReactShallowRenderer from 'react-test-renderer/shallow'
import ThreadCard, { lastMessageCreator, threadNames, ThreadAvatars } from './index'

it('renders correctly', () => {
  const message = {
    text: 'Hey, just checking in. Test, test, test.',
    creator: { id: 1 }
  }
  const currentUser = { id: 1, avatarUrl: 'fred.png' }

  const renderer = new ReactShallowRenderer()
  renderer.render(<ThreadCard message={message} isLast currentUser={currentUser} />)
  const actual = renderer.getRenderOutput()

  expect(actual).toMatchSnapshot()
})

describe('handles threadNames correctly', () => {
  it('handles when 1 name is passed', () => {
    const names = ['One name']
    expect(threadNames(names)).toBe('One name')
  })
  it('handles when multiple names are passed', () => {
    const names = ['One name', 'Second Name', 'Third Name']
    expect(threadNames(names)).toBe('One name and 2 others')
  })
})

describe('handles lastMessageCreator correctly', () => {
  it('handles when the current user created the message', () => {
    const formattedName = 'You: '
    const currentUser = { id: 1 }
    const message = {
      creator: { id: 1 }
    }
    expect(lastMessageCreator(message, currentUser, [])).toBe(formattedName)
  })
  it('handles when a different user created the message', () => {
    const name = 'name'
    const formattedName = 'name: '
    const currentUser = { id: 1 }
    const message = {
      creator: { id: 2 }
    }
    const participants = [
      { id: 2, name },
      { id: 3, name: 'other' },
      { id: 4, name: 'another' }
    ]
    expect(lastMessageCreator(message, currentUser, participants)).toBe(formattedName)
  })
  it('handles when there are 2 participants and a different user created the message', () => {
    const currentUser = { id: 1 }
    const message = {
      creator: { id: 2 }
    }
    const participants = [
      { id: 2, name: 'name1' },
      { id: 2, name: 'name2' }
    ]
    expect(lastMessageCreator(message, currentUser, participants)).toBe('')
  })
})

describe('handles ThreadAvatars correctly', () => {
  it('handles when there is one participant', () => {
    const avatarUrls = ['http://avatar.url']
    expect(ThreadAvatars({ avatarUrls })).toMatchSnapshot()
  })
  it('handles when there are two participants', () => {
    const avatarUrls = [
      'http://avatar.url',
      'http://avatar.url'
    ]
    expect(ThreadAvatars({ avatarUrls })).toMatchSnapshot()
  })
  it('handles when there are three participants', () => {
    const avatarUrls = [
      'http://avatar.url',
      'http://avatar.url',
      'http://avatar.url'
    ]
    expect(ThreadAvatars({ avatarUrls })).toMatchSnapshot()
  })
  it('handles when there are more than three participants', () => {
    const avatarUrls = [
      'http://avatar.url',
      'http://avatar.url',
      'http://avatar.url',
      'http://avatar.url'
    ]
    expect(ThreadAvatars({ avatarUrls })).toMatchSnapshot()
  })
})
