import { ReactRenderer } from '@tiptap/react'
import tippy from 'tippy.js'
import SuggestionList from './SuggestionList'

export default {
  render: (suggestionsThemeName = 'suggestions', onLoadMore) => {
    let component
    let popup

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

    return {
      onStart: props => {
        component = new ReactRenderer(SuggestionList, {
          props: { ...props, onLoadMore: (offset, query) => onLoadMore(offset, query, props.editor) },
          editor: props.editor
        })

        if (!props.clientRect) {
          return
        }

        popup = createPopup(props.clientRect)
      },

      onUpdate (props) {
        if (!props.clientRect || !component) return

        component.updateProps(props)

        if (!popup) { //  || (popup[0].state.isDestroyed) {
          popup = createPopup(props.clientRect)
        } else {
          const matches = props?.query?.match(/([\s]+)/g)
          const spacesCount = matches?.length || 0
          if (spacesCount > 1 && props.items.length === 0) {
            this.onExit()
            // popup?.[0]?.hide() // hide popup if we have more than one spaces but no result items (null in my case).
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
          // popup[0].hide()
          // Seems to be better to destroy and re-create in this case
          this.onExit()

          return true
        }

        // if (!popup?.[0].state.isShown && !popup?.[0].state.isDestroyed) {
        //   popup?.[0].show() // display the popup on key down
        // }

        return component?.ref?.onKeyDown(props)
      },

      onExit () {
        popup && popup[0].destroy()
        // Was causing a crashing bug
        component && setTimeout(() => component.destroy(), 500)
      }
    }
  }
}
