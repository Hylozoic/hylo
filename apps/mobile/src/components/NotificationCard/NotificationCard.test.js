import 'react-native'
import React from 'react'
import ReactShallowRenderer from 'react-test-renderer/shallow'
import NotificationCard from './NotificationCard'

describe('NotificationCard', () => {
  let notificationBase

  beforeEach(() => {
    notificationBase = {
      id: '55905',
      activityId: '12345',
      actor: {
        avatarUrl: 'https://wombat.com/test.jpg',
        name: 'Wombat Aardvark'
      },
      createdAt: '1 mo ago'
    }
  })

  it('matches the last snapshot for a mention', () => {
    const notification = {
      ...notificationBase,
      body: 'wrote: a post that mentions Forgle McWorfle',
      header: 'mentioned you',
      nameInHeader: true,
      title: 'A post to end all other posts, having an extremely long post title that just seems to go on and on and on and on'
    }
    const renderer = new ReactShallowRenderer()
    renderer.render(<NotificationCard notification={notification} />)
    expect(renderer.getRenderOutput()).toMatchSnapshot()
  })

  it('matches the last snapshot for a comment mention', () => {
    const notification = {
      ...notificationBase,
      body: 'wrote: a fairly long comment that in theory should get truncated by the line limit, and end in elipsis',
      header: 'mentioned you in a comment on',
      nameInHeader: true,
      title: 'A post to end all other posts, having an extremely long post title that just seems to go on and on and on and on'
    }
    const renderer = new ReactShallowRenderer()
    renderer.render(<NotificationCard notification={notification} />)
    expect(renderer.getRenderOutput()).toMatchSnapshot()
  })

  it('matches the last snapshot for a comment', () => {
    const notification = {
      ...notificationBase,
      body: 'wrote: a fairly long comment that in theory should get truncated by the line limit, and end in elipsis',
      header: 'New comment on',
      title: 'A post to end all other posts, having an extremely long post title that just seems to go on and on and on and on'
    }
    const renderer = new ReactShallowRenderer()
    renderer.render(<NotificationCard notification={notification} />)
    expect(renderer.getRenderOutput()).toMatchSnapshot()
  })

  it('matches the last snapshot for a post in topic', () => {
    const notification = {
      ...notificationBase,
      body: 'wrote: a fairly long comment that in theory should get truncated by the line limit, and end in elipsis',
      header: 'New post in',
      topic: 'hydroponics'
    }
    const renderer = new ReactShallowRenderer()
    renderer.render(<NotificationCard notification={notification} />)
    expect(renderer.getRenderOutput()).toMatchSnapshot()
  })

  it('matches the last snapshot for a join request', () => {
    const notification = {
      ...notificationBase,
      body: 'requested to join',
      group: 'Hydroponic Gardening',
      header: 'New join request',
      nameInHeader: true
    }
    const renderer = new ReactShallowRenderer()
    renderer.render(<NotificationCard notification={notification} />)
    expect(renderer.getRenderOutput()).toMatchSnapshot()
  })

  it('matches the last snapshot for a join approved', () => {
    const notification = {
      ...notificationBase,
      body: 'approved your request to join',
      group: 'Hydroponic Gardening',
      header: 'Join Request Approved'
    }
    const renderer = new ReactShallowRenderer()
    renderer.render(<NotificationCard notification={notification} />)
    expect(renderer.getRenderOutput()).toMatchSnapshot()
  })
})
