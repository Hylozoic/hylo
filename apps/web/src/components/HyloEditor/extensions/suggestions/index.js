import { ReactRenderer } from '@tiptap/react'
import tippy from 'tippy.js'
import SuggestionList from './SuggestionList'

/**
 * TipTap's suggestion plugin sets `items` to `[]` until the async `items()`
 * call resolves. Our list expects `{ items, hasMore, query, loading, requestId }`.
 */
function normalizeItems (props, extras = {}) {
  const raw = props.items
  if (raw && !Array.isArray(raw) && Array.isArray(raw.items)) {
    return { ...raw, query: raw.query ?? props.query ?? '', ...extras }
  }
  return {
    items: [],
    hasMore: false,
    query: props.query || '',
    loading: true,
    ...extras
  }
}

export default {
  render: (suggestionsThemeName = 'suggestions', onLoadMore) => {
    let component
    let popup
    let exited = false

    const createPopup = clientRect => {
      const tippyOptions = {
        theme: suggestionsThemeName,
        getReferenceClientRect: clientRect,
        // May not be necessary, but feels better for Mobile at least
        appendTo: () => document.body,
        content: component.element,
        showOnCreate: true,
        interactive: true,
        trigger: 'manual',
        arrow: false,
        offset: -10,
        placement: 'bottom-start'
      }

      if (suggestionsThemeName === 'suggestions-mobile') {
        // This handles the case of the Mobile Editor being in a container that is not
        // tall enough to accommodate suggestions. Adds padding while suggesting, removes
        // it on cancel or when a selection has been made.
        return tippy('body', {
          ...tippyOptions,
          onShown: () => {
            const suggestionsElement = document.querySelector('[data-tooltip-contentpy-root]')
            const suggestionsHeight = parseInt(window.getComputedStyle(suggestionsElement).height) || 0
            const proseMirrorElement = document.querySelector('.ProseMirror')
            const proseMirrorElementHeight = parseInt(window.getComputedStyle(proseMirrorElement).height)

            if (proseMirrorElementHeight < (suggestionsHeight + 50)) {
              proseMirrorElement.classList.add('suggestion-list-padding')
            }
          },
          onHide: () => {
            const proseMirrorElement = document.querySelector('.ProseMirror')

            proseMirrorElement.classList.remove('suggestion-list-padding')
          }
        })
      }

      return tippy('body', tippyOptions)
    }

    const listPropsFor = (props, extras) => ({
      ...props,
      items: normalizeItems(props, extras),
      onLoadMore: onLoadMore
        ? (offset, query) => onLoadMore(offset, query, props.editor)
        : undefined
    })

    /**
     * Mount the dropdown immediately (before search resolves) so typing `@Name`
     * quickly still activates, then update it when results arrive.
     */
    const mountOrUpdate = (props, extras = {}) => {
      if (exited) return

      const nextProps = listPropsFor(props, extras)

      if (!component) {
        component = new ReactRenderer(SuggestionList, {
          props: nextProps,
          editor: props.editor
        })
      } else {
        component.updateProps(nextProps)
      }

      if (!props.clientRect) return

      if (!popup) {
        popup = createPopup(props.clientRect)
      }
    }

    return {
      onBeforeStart (props) {
        exited = false
        mountOrUpdate(props, { loading: true })
      },

      onStart (props) {
        if (exited) return
        mountOrUpdate(props)
      },

      onUpdate (props) {
        if (exited) return

        if (!component) {
          mountOrUpdate(props)
          return
        }

        component.updateProps(listPropsFor(props))

        if (!props.clientRect) return

        if (!popup) {
          popup = createPopup(props.clientRect)
        } else {
          const matches = props?.query?.match(/([\s]+)/g)
          const spacesCount = matches?.length || 0
          const itemCount = Array.isArray(props.items)
            ? props.items.length
            : props.items?.items?.length
          if (spacesCount > 1 && itemCount === 0) {
            this.onExit()
            return
          }

          if (!popup[0].state.isDestroyed) {
            setTimeout(() => {
              popup[0].setProps({
                getReferenceClientRect: props.clientRect
              })
            }, 100)
          }
        }
      },

      onKeyDown (props) {
        if (props.event.key === 'Escape') {
          this.onExit()

          return true
        }

        return component?.ref?.onKeyDown(props)
      },

      onExit () {
        exited = true
        if (popup) {
          popup[0].destroy()
          popup = null
        }
        if (component) {
          const toDestroy = component
          component = null
          // Was causing a crashing bug
          setTimeout(() => toDestroy.destroy(), 500)
        }
      }
    }
  }
}
