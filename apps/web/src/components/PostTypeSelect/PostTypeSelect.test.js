/* eslint-env jest */
import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { POST_TYPES } from 'store/models/Post'
import PostTypeSelect from './PostTypeSelect'

const LOCALES = ['en', 'de', 'es', 'fr', 'hi', 'pt']

beforeAll(() => {
  // Radix Select measures and scrolls its list, which jsdom does not implement
  window.HTMLElement.prototype.scrollIntoView = jest.fn()
  window.HTMLElement.prototype.hasPointerCapture = jest.fn()
  window.HTMLElement.prototype.releasePointerCapture = jest.fn()
})

function openSelect () {
  fireEvent.keyDown(screen.getByRole('combobox'), { key: 'ArrowDown' })
}

describe('PostTypeSelect', () => {
  it('shows only the selected type in the closed picker', () => {
    render(<PostTypeSelect postType='request' setPostType={jest.fn()} />)
    expect(screen.getByRole('combobox')).toHaveTextContent('request')
    expect(screen.queryByText(POST_TYPES.request.description)).not.toBeInTheDocument()
  })

  it('shows each type with its description underneath when open', () => {
    render(<PostTypeSelect postType='discussion' setPostType={jest.fn()} />)
    openSelect()

    for (const type of ['discussion', 'event', 'offer', 'request', 'resource', 'project', 'proposal']) {
      expect(screen.getByTestId(`post-type-description-${type}`)).toHaveTextContent(POST_TYPES[type].description)
    }
    expect(screen.queryByTestId('post-type-description-chat')).not.toBeInTheDocument()
  })

  it('lists only the allowed types', () => {
    render(<PostTypeSelect postType='offer' allowedPostTypes={['offer', 'request']} setPostType={jest.fn()} />)
    openSelect()
    expect(screen.getByTestId('post-type-description-offer')).toBeInTheDocument()
    expect(screen.getByTestId('post-type-description-request')).toBeInTheDocument()
    expect(screen.queryByTestId('post-type-description-event')).not.toBeInTheDocument()
  })

  it('has every description translated in all six languages', () => {
    const descriptions = Object.values(POST_TYPES).map(postType => postType.description).filter(Boolean)
    for (const locale of LOCALES) {
      const strings = require(`../../../public/locales/${locale}.json`)
      for (const description of descriptions) {
        if (description === POST_TYPES.action.description) continue
        expect({ locale, description, translated: !!strings[description] }).toEqual({ locale, description, translated: true })
      }
    }
  })
})
