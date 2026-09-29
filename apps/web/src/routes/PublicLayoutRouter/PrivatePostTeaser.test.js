import React from 'react'
import { render, screen } from 'util/testing/reactTestingLibraryExtended'
import PrivatePostTeaser from './PrivatePostTeaser'

const returnToUrl = '/post/12?commentId=3'

describe('PrivatePostTeaser', () => {
  it('without a group, says the post is in a private group and keeps the post as returnToUrl for both buttons', () => {
    render(<PrivatePostTeaser group={null} returnToUrl={returnToUrl} />)
    expect(screen.getByTestId('private-post-teaser')).toBeInTheDocument()
    expect(screen.getByText('This post is in a private group')).toBeInTheDocument()
    const encoded = encodeURIComponent(returnToUrl)
    expect(screen.getByRole('link', { name: 'Sign up' })).toHaveAttribute('href', `/signup?returnToUrl=${encoded}`)
    expect(screen.getByRole('link', { name: 'Log in' })).toHaveAttribute('href', `/login?returnToUrl=${encoded}`)
  })

  it('with a public group, names it and offers Sign up to request access', () => {
    render(<PrivatePostTeaser group={{ name: 'Open Garden', slug: 'open-garden', avatarUrl: 'https://example.com/a.png' }} returnToUrl={returnToUrl} />)
    expect(screen.getByTestId('private-post-teaser-group')).toBeInTheDocument()
    expect(screen.getByText('This post is in Open Garden')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Sign up to request access' }))
      .toHaveAttribute('href', `/signup?returnToUrl=${encodeURIComponent('/groups/open-garden')}`)
    expect(screen.getByRole('link', { name: 'Log in' }))
      .toHaveAttribute('href', `/login?returnToUrl=${encodeURIComponent(returnToUrl)}`)
  })
})
