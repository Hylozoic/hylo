import React from 'react'
import { useLocation } from 'react-router-dom'
import { render, screen } from 'util/testing/reactTestingLibraryExtended'
import PublicPageHeader from './PublicPageHeader'

describe('PublicPageHeader', () => {
  it('brings people back to this page after they sign up or sign in', () => {
    useLocation.mockReturnValue({ pathname: '/post/91', search: '?commentId=4' })
    render(<PublicPageHeader />)

    const returnToUrl = encodeURIComponent('/post/91?commentId=4')
    expect(screen.getByRole('link', { name: 'Join Hylo' })).toHaveAttribute('href', `/signup?returnToUrl=${returnToUrl}`)
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', `/login?returnToUrl=${returnToUrl}`)
  })

  it('links to plain sign up and sign in from the root page', () => {
    useLocation.mockReturnValue({ pathname: '/', search: '' })
    render(<PublicPageHeader />)

    expect(screen.getByRole('link', { name: 'Join Hylo' })).toHaveAttribute('href', '/signup')
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login')
  })
})
