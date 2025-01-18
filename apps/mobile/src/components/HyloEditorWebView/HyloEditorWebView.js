import React, { useState, useRef, useEffect, useImperativeHandle } from 'react'
import { Dimensions } from 'react-native'
import { WebViewMessageTypes } from '@hylo/shared'
import { isIOS } from 'util/platform'
import HyloWebView, { sendMessageFromWebView } from 'components/HyloWebView'

const DEFAULT_WIDTH_OFFSET_IOS = 18
const EMPTY_STATE = '<p></p>'

export const HyloEditorWebView = React.forwardRef(({
  contentHTML: providedContentHTML,
  groupIds,
  onAddTopic,
  onAddLink,
  onEnter,
  onUpdate,
  placeholder,
  readOnly,
  renderLoading = () => {},
  showMenu,
  widthOffset = 0,
  // Only send `customEditorCSS`
  // but here are all style options
  style,
  containerStyle,
  customEditorCSS = ''
}, ref) => {
  const webViewRef = useRef()
  const [path] = useState('/hyloApp/editor')
  const [isEmpty, setIsEmpty] = useState(true)
  const [contentHTML, setContentHTML] = useState()
  const [loaded, setLoaded] = useState()

  const messageHandler = ({ type, data }) => {
    switch (type) {
      case WebViewMessageTypes.EDITOR.LOADED: {
        setLoaded(true)
        break
      }

      case WebViewMessageTypes.EDITOR.ON_UPDATE: {
        setContentHTML(data)
        setIsEmpty(data.trim() === EMPTY_STATE)
        onUpdate && onUpdate(data)
        break
      }

      case WebViewMessageTypes.EDITOR.ON_ADD_LINK: {
        onAddLink && onAddLink(data)
        break
      }

      case WebViewMessageTypes.EDITOR.ON_ADD_TOPIC: {
        onAddTopic && onAddTopic(data)
        break
      }

      case WebViewMessageTypes.EDITOR.ON_ENTER: {
        onEnter && onEnter(data)
        break
      }
    }
  }

  useEffect(() => {
    if (loaded) {
      sendMessageFromWebView(
        webViewRef,
        WebViewMessageTypes.EDITOR.SET_PROPS, {
          readOnly,
          showMenu,
          placeholder,
          groupIds
        }
      )
    }
  }, [loaded, readOnly, showMenu, placeholder, groupIds])

  useEffect(() => {
    if (loaded) {
      sendMessageFromWebView(
        webViewRef,
        WebViewMessageTypes.EDITOR.SET_PROPS, {
          content: providedContentHTML
        }
      )
    }
  }, [loaded, providedContentHTML])

  useImperativeHandle(ref, () => ({
    blur: () => {
      sendMessageFromWebView(
        webViewRef,
        WebViewMessageTypes.EDITOR.BLUR
      )
    },
    clearContent: () => {
      sendMessageFromWebView(
        webViewRef,
        WebViewMessageTypes.EDITOR.CLEAR_CONTENT
      )
      setIsEmpty(true)
    },
    focus: position => {
      webViewRef?.current?.requestFocus()
      sendMessageFromWebView(
        webViewRef,
        WebViewMessageTypes.EDITOR.FOCUS,
        position
      )
    },
    getHTML: () => {
      return contentHTML
    },
    isEmpty,
    setContent: newContentHTML => {
      sendMessageFromWebView(
        webViewRef,
        WebViewMessageTypes.EDITOR.SET_PROPS, {
          content: newContentHTML
        }
      )
    }
  }), [isEmpty, contentHTML, webViewRef])

  return React.createElement(HyloWebView, {
    path,
    messageHandler,
    renderLoading,
    // Seems to help but when it's relied upon (e.g. PostEditor height)
    // it causes 2 resizes and could probably be handled better otherwise
    automaticallyAdjustContentInsets: false,
    customStyle: `
      .ProseMirror {
        /* May be needed, but probably not as this is default */
        height: auto;
        overflow-y: scroll;
        ${customEditorCSS}
      }

      /*
        Fix for disappearing vertical scrollbar in Android
        having "overflow: auto" above was partial cause.

        If we can make "scalesToFitPage: false" work on Android
        this hack should be able to be dropped.
      */

      .ProseMirror::-webkit-scrollbar {
        width: 5px;
      }

      .ProseMirror::-webkit-scrollbar-thumb {
        width: 5px;
        border-radius: 1rem;
        background: #AAA;
      }
    `,
    containerStyle,
    hideKeyboardAccessoryView: true,
    ref: webViewRef,
    // For debugging:
    // onSizeUpdated: size => console.log(size.height),

    // `true` seems critical for Android, but works fine when `false` on iOS and is better
    // for predictable sizing.
    // also ref: https://github.com/iou90/react-native-autoheight-webview/issues/242
    scalesPageToFit: !isIOS,
    // they needed to be slightly different and that seems to work fine.
    style: [style, {
      // Note: See docs for `AutoHeightWebView`. Their recommendation for iOS:
      //   `import { Dimensions } from 'react-native'`
      //   `style={{ width: Dimensions.get('window').width - 15, marginTop: 35 }}`
      // Currently using a manually set `widthOffset` in `PostEditor` and `CommentEditor`
      width: Dimensions.get('window').width - DEFAULT_WIDTH_OFFSET_IOS - widthOffset
    }],
    // Not sure this matters and is the default for AutoHeight,
    // setting here in case we set a different default for HyloWebView
    showsVerticalScrollIndicator: true
  })
})

export default HyloEditorWebView
