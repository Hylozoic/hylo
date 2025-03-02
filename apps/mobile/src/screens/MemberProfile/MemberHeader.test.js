import 'react-native'
import React from 'react'
import ReactShallowRenderer from 'react-test-renderer/shallow'
import MemberHeader, { MemberMenu } from './MemberHeader'

describe('MemberHeader', () => {
  it('matches the last snapshot', () => {
    const person = {
      name: 'Jonas',
      location: 'whale',
      tagline: 'fingers crossed'
    }

    const renderer = new ReactShallowRenderer()
    renderer.render(<MemberHeader
      flagMember={() => {}}
      person={person}
      updateSetting={() => () => {}}
      isMe
                    />)
    const actual = renderer.getRenderOutput()

    expect(actual).toMatchSnapshot()
  })
})

describe('MemberMenu', () => {
  it('returns null when flagging not allowed', () => {
    const renderer = new ReactShallowRenderer()
    renderer.render(<MemberMenu />)
    const actual = renderer.getRenderOutput()

    expect(actual).toMatchSnapshot()
  })

  it('returns a popupmenu when flagging allowed', () => {
    const renderer = new ReactShallowRenderer()
    renderer.render(<MemberMenu flagMember={() => { }} />)
    const actual = renderer.getRenderOutput()

    expect(actual).toMatchSnapshot()
  })
})
