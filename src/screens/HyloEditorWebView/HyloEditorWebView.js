import React, { useState, useRef, useEffect, useImperativeHandle } from 'react'
import { Dimensions } from 'react-native'
import { WebViewMessageTypes } from 'hylo-shared'
import HyloWebView, { sendMessageFromWebView, parseWebViewMessage } from 'screens/HyloWebView'

const DEFAULT_WIDTH_OFFSET_IOS = 15
const EMPTY_STATE = '<p></p>'

export function HyloEditorWebView ({
  contentHTML: providedContentHTML,
  placeholder,
  readOnly,
  groupIds,
  showMenu,
  onUpdate,
  onAddTopic,
  onAddLink,
  onEnter,
  style,
  containerStyle,
  customStyle,
  widthOffset = 0
}, ref) {
  const webViewRef = useRef()
  // const [path] = useState('hyloApp/editor?suppressEnterKeyPropagation=true')
  const [path] = useState('hyloApp/editor')
  const [isEmpty, setIsEmpty] = useState(true)
  const [contentHTML, setContentHTML] = useState()
  const [loaded, setLoaded] = useState()

  const handleMessage = message => {
    const { type, data } = parseWebViewMessage(message)

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
      // setContentHTML(providedContentHTML)
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
      // setContentHTML(newContentHTML)
    }
  }), [isEmpty, contentHTML, webViewRef])

  return React.createElement(HyloWebView, {
    path,
    onMessage: handleMessage,
    startInLoadingState: false,
    customStyle,
    //  || `
    //   .hyloEditorMobileContainer {
    //     padding: 8px;
    //     height: auto;
    //     overflow-y: auto;
    //   }
    //   .ProseMirror p.is-editor-empty:first-child::after {
    //     margin-bottom: 0px;
    //   }
    //   .hyloEditorMobileContainer .hyloEditorMobile .ProseMirror {
    //     height: auto;
    //     max-height: 200px;
    //   }
    // `,
    // Related to getting auto-height right and scrolling:
    scrollEnabled: false,
    nestedScrollEnabled: true,
    scalesPageToFit: false,
    // Seems to help but when it's relied upon (e.g. PostEditor height)
    // it causes 2 resizes and could probably be handled better otherwise
    automaticallyAdjustContentInsets: true,
    style: [style, {
      // If Android crashes, apply this fix (ref. https://github.com/iou90/react-native-autoheight-webview/issues/191)
      // opacity: 0.99, minHeight: 1
      width: Dimensions.get('window').width - DEFAULT_WIDTH_OFFSET_IOS - widthOffset
    }],
    containerStyle,
    ref: webViewRef,
    showsVerticalScrollIndicator: true,
    hideKeyboardAccessoryView: true
  })
}

export default React.forwardRef(HyloEditorWebView)
