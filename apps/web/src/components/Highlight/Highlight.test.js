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
    expect(screen.getByText(/and one/i)).toBeInTheDocument()
    expect(screen.getByText(/and another/i)).toBeInTheDocument()
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
    const markup = (
      <div>
        <span>one cat and one doge</span>
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

    const highlightedCat = screen.getByText('cat')
    expect(highlightedCat).toHaveClass(highlightClassName)
    expect(screen.queryByText(/doge/i)).not.toHaveClass(highlightClassName)
  })

  it('only matches complete words (complex)', () => {
    const html = <div>
      <span>one cat and one doge</span>
      <span>
        <ul>a caterpillar and a dog</ul>
      </span>
    </div>

    render(
      <Highlight
        className={componentClassName}
        terms={terms}
        highlightClassName={highlightClassName}
      >
        {html}
      </Highlight>
    )

    const highlightedCat = screen.getByText('cat')
    const highlightedDog = screen.getByText('dog')
    expect(highlightedCat).toHaveClass(highlightClassName)
    expect(highlightedDog).toHaveClass(highlightClassName)
    expect(screen.queryByText(/doge/)).not.toHaveClass(highlightClassName)
    expect(screen.queryByText(/caterpillar/)).not.toHaveClass(highlightClassName)
  })
})
