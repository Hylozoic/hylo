import Mention from '@tiptap/extension-mention'
import { PluginKey } from 'prosemirror-state'
import { queryHyloAPI } from 'util/graphql'
import asyncDebounce from 'util/asyncDebounce'
import suggestions from './suggestions'
import findMentions from 'store/actions/findMentions'

const MAX_SUGGESTIONS = 7

const loadPeople = async (offset = 0, query, editor) => {
  const findMentionsGraphql = findMentions({
    autocomplete: query,
    groupIds: editor.extensionStorage.mention.groupIds,
    maxItems: MAX_SUGGESTIONS,
    offset
  }).graphql

  const result = query.length > 0 ? await queryHyloAPI(findMentionsGraphql) : null

  return {
    items: result?.data?.people?.items?.map(person => ({
      id: person.id,
      label: person.name,
      avatarUrl: person.avatarUrl,
      suggestionLabel: person.name
    })) || [],
    hasMore: result?.data?.people?.hasMore || false,
    query
  }
}

export const PeopleMentions = ({ groupIds, onSelection, suggestionsThemeName }) =>
  Mention
    .extend({
      name: 'mention',
      addStorage () {
        return {
          loading: false,
          groupIds,
          onSelection

        }
      },
      onUpdate ({ transaction }) {
        if (this.storage.onSelection) {
          // Look into `doc.descendents` for possible better or more idiomatic way to get this last node
          const firstTransactionStepName = transaction?.steps[0]?.slice?.content?.content[0]?.type?.name

          if (firstTransactionStepName && firstTransactionStepName === 'mention') {
            const attrs = transaction?.steps[0]?.slice?.content?.content[0]?.attrs

            this.storage.onSelection(attrs)
          }
        }
      }
    })
    .configure({
      HTMLAttributes: {
        class: 'mention'
      },
      renderHTML: ({ options, node }) => {
        return ['span', { class: 'mention', 'data-id': node.attrs.id }, node.attrs.label ?? node.attrs.id]
      },
      suggestion: {
        char: '@',
        allowSpaces: true,
        pluginKey: new PluginKey('mentionSuggestion'),
        render: () => suggestions.render(
          suggestionsThemeName,
          loadPeople
        ),
        items: asyncDebounce(200, async ({ query, editor }) => {
          editor.extensionStorage.topic.loading = true
          const results = await loadPeople(0, query, editor)
          editor.extensionStorage.topic.loading = false
          return results
        })
      }
    })

export default PeopleMentions
