import 'react-native'
import React from 'react'
import ReactShallowRenderer from 'react-test-renderer/shallow'
import ReactTestRenderer from 'react-test-renderer'
import ItemChooser from './ItemChooser'

const items = [
  { id: 'member1' },
  { id: 'member2' }
]

const testProps = {
  fetchSearchSuggestions: () => {
    return { type: 'test-search' }
  },
  t: str => str,
  getSearchSuggestions: () => items,
  setSearchTerm: jest.fn(),
  ItemRowComponent: item => null,
  onFocus: jest.fn(),
  autoFocus: true,
  initialItems: [],
  route: {
    params: {
      screenTitle: 'Screen Title',
      initialItems: items,
      ItemRowComponent: item => null,
      fetchSearchSuggestions: () => {
        return { type: 'test-search' }
      },
      getSearchSuggestions: () => items,
      updateItems: jest.fn()
    }
  },
  navigation: {
    setParams: jest.fn(),
    setOptions: jest.fn()
  }
}

// TODO: Pending tests
// snapshot test difference between render of pick vs choose itemschooser?
// test for updateItems
// test that done for update Items and cancel do what are expected
// test that cancel does what is expected for pickItem
// test pickItem

describe('ItemChooser', () => {
  it('shallow renders as expected', () => {
    const renderer = new ReactShallowRenderer()
    renderer.render(<ItemChooser {...testProps} />)
    expect(renderer.getRenderOutput()).toMatchSnapshot()
  })

  it('full renders as expected', () => {
    const renderer = ReactTestRenderer.create(<ItemChooser {...testProps} />)

    expect(renderer.toJSON()).toMatchSnapshot()
  })

  describe('#setupItemSections', () => {
    describe('for picker', () => {
      it('renders sections', () => {
        const props = {
          ...testProps,
          initialItems: [
            { id: '1' },
            { id: '2' },
            { id: '3' }
          ]
        }
        const renderer = ReactTestRenderer.create(<ItemChooser {...props} />)
        const instance = renderer.getInstance()
        instance.setState({ chosenItems: [{ id: '5' }] })

        expect(instance.setupItemSections([])).toMatchSnapshot()
      })

      it('renders suggested items when search term supplied', () => {
        const props = {
          ...testProps,
          searchTerm: 'test',
          initialItems: [
            { id: '1' }
          ]
        }
        const renderer = ReactTestRenderer.create(<ItemChooser {...props} />)
        const instance = renderer.getInstance()
        const suggestedItems = [
          { id: '1' },
          { id: '2' },
          { id: '3' }
        ]
        expect(instance.setupItemSections(suggestedItems)).toMatchSnapshot()
      })

      it('renders default suggested items', () => {
        const props = {
          ...testProps,
          defaultSuggestedItemsLabel: 'Recent Items',
          defaultSuggestedItems: [
            { id: '1' },
            { id: '2' },
            { id: '3' }
          ]
        }
        const renderer = ReactTestRenderer.create(<ItemChooser {...props} />)
        const instance = renderer.getInstance()
        expect(instance.setupItemSections([])).toMatchSnapshot()
      })
    })

    describe('for chooser', () => {
      it('renders suggested items when search term supplied', () => {
        const props = {
          ...testProps,
          updateItems: jest.fn(),
          searchTerm: 'test',
          initialItems: [
            { id: '1' }
          ]
        }
        const renderer = ReactTestRenderer.create(<ItemChooser {...props} />)
        const instance = renderer.getInstance()
        const suggestedItems = [
          { id: '1' },
          { id: '2' },
          { id: '3' }
        ]
        expect(instance.setupItemSections(suggestedItems)).toMatchSnapshot()
      })

      it('renders current selection if intialItems is defined (no headers)', () => {
        const props = {
          ...testProps,
          updateItems: jest.fn(),
          initialItems: [
            { id: '1' },
            { id: '2' },
            { id: '3' }
          ]
        }
        const renderer = ReactTestRenderer.create(<ItemChooser {...props} />)
        const instance = renderer.getInstance()
        expect(instance.setupItemSections([])).toMatchSnapshot()
      })

      it('renders suggested items when search term supplied', () => {
        const props = {
          ...testProps,
          updateItems: jest.fn(),
          searchTerm: 'test',
          initialItems: [
            { id: '1' }
          ]
        }
        const renderer = ReactTestRenderer.create(<ItemChooser {...props} />)
        const instance = renderer.getInstance()
        const suggestedItems = [
          { id: '1' },
          { id: '2' },
          { id: '3' }
        ]
        expect(instance.setupItemSections(suggestedItems)).toMatchSnapshot()
      })

      it('renders current selection with header if initialItems and addedItems are defined ', () => {
        const props = {
          ...testProps,
          updateItems: jest.fn(),
          initialItems: [
            { id: '1' }
          ]
        }
        const renderer = ReactTestRenderer.create(<ItemChooser {...props} />)
        const instance = renderer.getInstance()
        const chosenItems = [
          { id: '2' },
          { id: '3' }
        ]
        instance.setState({ chosenItems })
        expect(instance.setupItemSections([])).toMatchSnapshot()
      })

      it('renders sections', () => {
        const props = {
          ...testProps,
          updateItems: jest.fn(),
          initialItems: [
            { id: '1' },
            { id: '2' },
            { id: '3' }
          ]
        }
        const renderer = ReactTestRenderer.create(<ItemChooser {...props} />)
        const instance = renderer.getInstance()
        instance.setState({ chosenItems: [{ id: '5' }] })

        expect(instance.setupItemSections([])).toMatchSnapshot()
      })
    })
  })
})
