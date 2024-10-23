import React from 'react'
import { render, screen } from 'util/testing/reactTestingLibraryExtended'
import Highlight from './Highlight'

describe('Highlight', () => {
  const highlightClassName = 'highlight-span'
  const componentClassName = 'highlight-component'
  const terms = ['cat', 'dog']

  it('highlights terms in a react tree', () => {
    const markup = (
      <div className='cat'>
        <span>one cat and one dog</span>
        <span className='dog'>
          <ul>another cat and another cat</ul>
        </span>
      </div>
    )

    render(
      <Highlight
        className={componentClassName}
        terms={terms}
        highlightClassName={highlightClassName}
      >
        {markup}
      </Highlight>
    )

    expect(screen.getAllByText('cat', { exact: false })).toHaveLength(3)
    expect(screen.getAllByText('dog', { exact: false })).toHaveLength(1)
    expect(screen.getByText('one cat and one dog')).toBeInTheDocument()
    expect(screen.getByText('another cat and another cat')).toBeInTheDocument()
  })

  it('works with dangerouslySetInnerHTML (simple)', () => {
    const html = `starts with a cat <div>
      <span>one cat</span>
    </div> ends with a dog`

    render(
      <Highlight
        className={componentClassName}
        terms={terms}
        highlightClassName={highlightClassName}
      >
        <div className='outer' dangerouslySetInnerHTML={{ __html: html }} />
      </Highlight>
    )

    expect(screen.getAllByText('cat', { exact: false })).toHaveLength(2)
    expect(screen.getByText('dog', { exact: false })).toBeInTheDocument()
    expect(screen.getByText('starts with a', { exact: false })).toBeInTheDocument()
    expect(screen.getByText('ends with a', { exact: false })).toBeInTheDocument()
  })

  it('works with dangerouslySetInnerHTML (complex)', () => {
    const html = `starts with a cat <div className='cat'>
      <span>one cat and one dog</span>
      <span className='dog'>
        <ul>another cat and another cat</ul>
      </span>
    </div> ends with a dog`

    render(
      <Highlight
        className={componentClassName}
        terms={terms}
        highlightClassName={highlightClassName}
      >
        <div className='outer' dangerouslySetInnerHTML={{ __html: html }} />
      </Highlight>
    )

    expect(screen.getAllByText('cat', { exact: false })).toHaveLength(4)
    expect(screen.getAllByText('dog', { exact: false })).toHaveLength(2)
    expect(screen.getByText('one cat and one dog')).toBeInTheDocument()
    expect(screen.getByText('another cat and another cat')).toBeInTheDocument()
  })

  it('removes non word characters from search terms', () => {
    const terms = ['$%&^<dog>.,/.>']
    const markup = <div>just a solitary dog</div>

    render(
      <Highlight
        className={componentClassName}
        terms={terms}
        highlightClassName={highlightClassName}
      >
        {markup}
      </Highlight>
    )

    const highlightedDog = screen.getByText('dog')
    expect(highlightedDog).toHaveClass(highlightClassName)
  })

  it('only matches complete words (simple)', () => {
    const html = `<div>
      <span>one cat and one doge</span>
    </div>`

    render(
      <Highlight
        className={componentClassName}
        terms={terms}
        highlightClassName={highlightClassName}
      >
        <div className='outer' dangerouslySetInnerHTML={{ __html: html }} />
      </Highlight>
    )

    const highlightedCat = screen.getByText('cat')
    expect(highlightedCat).toHaveClass(highlightClassName)
    expect(screen.queryByText('doge')).not.toHaveClass(highlightClassName)
  })

  it('only matches complete words (complex)', () => {
    const html = `<div>
      <span>one cat and one doge</span>
      <span>
        <ul>a caterpillar and a dog</ul>
      </span>
    </div>`

    render(
      <Highlight
        className={componentClassName}
        terms={terms}
        highlightClassName={highlightClassName}
      >
        <div className='outer' dangerouslySetInnerHTML={{ __html: html }} />
      </Highlight>
    )

    const highlightedCat = screen.getByText('cat')
    const highlightedDog = screen.getByText('dog')
    expect(highlightedCat).toHaveClass(highlightClassName)
    expect(highlightedDog).toHaveClass(highlightClassName)
    expect(screen.queryByText('doge')).not.toHaveClass(highlightClassName)
    expect(screen.queryByText('caterpillar')).not.toHaveClass(highlightClassName)
  })
})
