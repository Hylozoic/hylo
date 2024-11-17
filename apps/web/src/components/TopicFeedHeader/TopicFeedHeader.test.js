import React from 'react'
import { render, screen, fireEvent } from 'util/testing/reactTestingLibraryExtended'
import TopicFeedHeader from './TopicFeedHeader'

const topicName = 'Petitions'
const bannerUrl = 'some.url'

const defaultTestProps = {
  topicName,
  currentUser: {
    firstName: () => 'anybody'
  }
}

describe('TopicFeedHeader', () => {
  it('displays the topic name', () => {
    render(<TopicFeedHeader {...defaultTestProps} />)
    expect(screen.getByText(`#${topicName}`)).toBeInTheDocument()
  })

  describe('meta', () => {
    it('uses values of 0 if the meta info is not passed in', () => {
      render(<TopicFeedHeader {...defaultTestProps} />)
      expect(screen.getByText('0 subscribers')).toBeInTheDocument()
    })

    it('correctly pluralizes meta counts when count is 0', () => {
      render(<TopicFeedHeader {...defaultTestProps} followersTotal={0} />)
      expect(screen.getByText('0 subscribers')).toBeInTheDocument()
    })

    it('correctly pluralizes counts when count is 1', () => {
      render(<TopicFeedHeader {...defaultTestProps} followersTotal={1} />)
      expect(screen.getByText('1 subscriber')).toBeInTheDocument()
    })

    it('correctly pluralizes counts when count is greater than 1', () => {
      render(<TopicFeedHeader {...defaultTestProps} followersTotal={2} />)
      expect(screen.getByText('2 subscribers')).toBeInTheDocument()
    })
  })

  describe('subscribe', () => {
    it('shows subscribe button if toggleSubscribe prop is present', () => {
      render(<TopicFeedHeader {...defaultTestProps} toggleSubscribe={() => {}} />)
      expect(screen.getByRole('button', { name: /subscribe/i })).toBeInTheDocument()
    })

    it('does not show subscribe button if toggleSubscribe prop is not present', () => {
      render(<TopicFeedHeader {...defaultTestProps} />)
      expect(screen.queryByRole('button', { name: /subscribe/i })).not.toBeInTheDocument()
    })

    it('should say Subscribe when not subscribed', () => {
      render(<TopicFeedHeader {...defaultTestProps} toggleSubscribe={() => {}} isSubscribed={false} />)
      expect(screen.getByRole('button', { name: 'Subscribe' })).toBeInTheDocument()
    })

    it('should say Unsubscribe when subscribed', () => {
      render(<TopicFeedHeader {...defaultTestProps} toggleSubscribe={() => {}} isSubscribed />)
      expect(screen.getByRole('button', { name: 'Unsubscribe' })).toBeInTheDocument()
    })

    it('calls toggleSubscribe when sub/unsub button is clicked', () => {
      const toggleSubscribe = jest.fn()
      render(<TopicFeedHeader {...defaultTestProps} toggleSubscribe={toggleSubscribe} />)
      fireEvent.click(screen.getByRole('button', { name: /subscribe/i }))
      expect(toggleSubscribe).toHaveBeenCalledTimes(1)
    })
  })
})
