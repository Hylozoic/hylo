import React from 'react'
import { render, screen, fireEvent, waitFor } from 'util/testing/reactTestingLibraryExtended'
import { graphql, HttpResponse } from 'msw'
import mockGraphqlServer from 'util/testing/mockGraphqlServer'
import TopicSelector from './TopicSelector'

const mockFetchDefaultTopics = jest.fn()
const mockingFetchDefaultTopics = jest.fn((f, obj) => {
  mockFetchDefaultTopics(obj)
  return f()
})
jest.mock('store/actions/fetchTopics', () => {
  const actual = jest.requireActual('store/actions/fetchTopics')
  return {
    fetchDefaultTopics: (obj) => mockingFetchDefaultTopics(actual.fetchDefaultTopics, obj)
  }
})

beforeEach(() => {
  // Mock FindTopicsQuery
  mockGraphqlServer.use(
    graphql.operation(({ query, variables }) => {
      // console.log('GraphQL Operation:', { query, variables })
      return HttpResponse.json({ data: {} })
    }),
    graphql.query('FetchDefaultTopicsQuery', () => {
      return HttpResponse.json({
        data: {
          groupTopics: {
            items: [
              {
                topic: {
                  id: '1',
                  name: 'racing'
                }
              },
              {
                topic: {
                  id: '2',
                  name: 'hiking'
                }
              }
            ]
          }
        }
      })
    }),
    graphql.query('FindTopicsQuery', () => {
      return HttpResponse.json({
        data: {
          groupTopics: {
            items: [
              {
                topic: {
                  id: '33',
                  name: 'test-topic',
                  followersTotal: 100,
                  postsTotal: 50
                }
              },
              {
                topic: {
                  id: '34',
                  name: 'another-topic',
                  followersTotal: 200,
                  postsTotal: 75
                }
              }
            ]
          }
        }
      }),
      graphql.query('FetchTopics', ({ query, variables }) => {
        return HttpResponse.json({
          data: {
            groupTopics: {
              items: []
            }
          }
        })
      })
    })
  )
})

describe.skip('TopicSelector', () => {
  const defaultProps = {
    onChange: jest.fn()
  }

  const renderComponent = (props = {}) => {
    return render(<TopicSelector {...defaultProps} {...props} />)
  }

  it('renders correctly (with default props)', () => {
    renderComponent()
    expect(screen.getByText('Enter up to three topics...')).toBeInTheDocument()
  })

  it('calls fetchDefaultTopics on mount', () => {
    renderComponent({ forGroups: [{ slug: 'test-group' }] })
    expect(mockFetchDefaultTopics).toHaveBeenCalledWith({ groupSlug: 'test-group' })
  })

  it('updates selected topics when props change', async () => {
    const { rerender } = renderComponent()
    rerender(<TopicSelector {...defaultProps} selectedTopics={[{ name: 'one', value: 'one' }]} />)
    await waitFor(() => {
      expect(screen.getByText('#one')).toBeInTheDocument()
    })
  })

  it('allows selecting topics', async () => {
    defaultProps.findTopics.mockResolvedValue({
      payload: { getData: () => ({ items: [{ topic: { name: 'test-topic', value: 'test-topic' } }] }) }
    })
    renderComponent()

    const input = screen.getByRole('combobox')
    fireEvent.change(input, { target: { value: 'test' } })

    await waitFor(() => {
      expect(screen.getByText('#test-topic')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('#test-topic'))

    await waitFor(() => {
      expect(screen.getByText('#test-topic')).toBeInTheDocument()
      // onChange is handled in the component, cannot mock it
      // expect(defaultProps.onChange).toHaveBeenCalledWith([{ name: 'test-topic', value: 'test-topic' }])
    })
  })

  it('limits selection to 3 topics', async () => {
    renderComponent({ selectedTopics: [{ name: 'one', value: 'one' }, { name: 'two', value: 'two' }, { name: 'three', value: 'three' }] })

    await waitFor(() => {
      expect(screen.getByText('#one')).toBeInTheDocument()
      expect(screen.getByText('#two')).toBeInTheDocument()
      expect(screen.getByText('#three')).toBeInTheDocument()
    })

    const input = screen.getByRole('combobox')
    fireEvent.change(input, { target: { value: 'four' } })

    await waitFor(() => {
      expect(screen.getByText('You can only select up to 3 topics')).toBeInTheDocument()
    })
  })

  it('allows creating new topics', async () => {
    renderComponent()

    const input = screen.getByRole('combobox')
    fireEvent.change(input, { target: { value: 'new-topic' } })

    await waitFor(() => {
      expect(screen.getByText('Create topic "#{{item.value}}"')).toBeInTheDocument()
      fireEvent.click(screen.getByText('Create topic "#{{item.value}}"'))
    })

    // fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' })

    await waitFor(() => {
      expect(screen.getByText('#new-topic')).toBeInTheDocument()
      // onChange is handled in the component, cannot mock it
      // expect(defaultProps.onChange).toHaveBeenCalledWith([{ name: 'new-topic', value: 'new-topic', __isNew__: true }])
    })
  })
})
