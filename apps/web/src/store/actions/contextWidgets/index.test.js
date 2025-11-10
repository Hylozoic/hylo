import { deleteContextWidget } from './index'

describe('deleteContextWidget', () => {
  it('returns the delete action descriptor', () => {
    const result = deleteContextWidget({
      contextWidgetId: 'widget-1',
      groupId: 'group-1'
    })

    expect(result).toMatchObject({
      type: 'DELETE_CONTEXT_WIDGET',
      graphql: {
        variables: {
          contextWidgetId: 'widget-1'
        }
      },
      meta: {
        contextWidgetId: 'widget-1',
        groupId: 'group-1',
        optimistic: true
      }
    })
    expect(result.graphql.query).toContain('mutation ($contextWidgetId: ID)')
    expect(result.graphql.query).toContain('deleteContextWidget(contextWidgetId: $contextWidgetId)')
  })
})

