import React, { useCallback, useMemo } from 'react'
import { useWindowDimensions } from 'react-native'
import { RenderHTMLConfigProvider, RenderHTMLSource } from 'react-native-render-html'
import WebView from 'react-native-webview'
import iframe, { iframeModel } from '@native-html/iframe-plugin'
import { openURL } from 'hooks/useOpenURL'
import useGoToMember from 'hooks/useGoToMember'
import useGoToTopic from 'hooks/useGoToTopic'

const wrapInHTMLDoc = source => {
  return `
    <html>
    <head>
      <meta charset="utf-8">
      <base href="https://www.hylo.com">
    </head>
    <body>
      ${source}
    </body>
    </html>
  `
}

const htmlConfig = {
  customHTMLElementModels: {
    iframe: iframeModel
  },
  WebView
}

const defaultTextProps = {
  selectable: false
}

const SpanRenderer = ({ TDefaultRenderer, ...props }) => {
  const goToMember = useGoToMember()
  const goToTopic = useGoToTopic()

  const handlePress = () => {
    const textNode = props.tnode

    if (textNode.hasClass('mention')) {
      return goToMember(textNode.attributes['data-id'])
    }
    if (textNode.hasClass('topic')) {
      return goToTopic(textNode.attributes['data-id'])
    }
  }

  return (
    <TDefaultRenderer {...props} onPress={handlePress} />
  )
}

// Collapse `p` bottom margins when they are a child of a `li`
// Not possible using `react-native-render-html` due to lack of CSS Selectors
// Watch this feature request for updates on that: https://bit.ly/3MrQYZq
const CustomPRenderer = ({ TDefaultRenderer, ...props }) => {
  const fixMarginInListStyle = props?.tnode?.parent?.tagName === 'li' ? { marginBottom: 5 } : null

  return (
    <TDefaultRenderer {...props} style={{ ...props.style, ...fixMarginInListStyle }} />
  )
}

const renderers = {
  iframe,
  span: SpanRenderer,
  p: CustomPRenderer
}

export function HyloHTMLConfigProvider ({ children }) {
  const handleLinkPress = async (_, href) => openURL(href)

  const renderersProps = useMemo(() => ({
    a: { onPress: handleLinkPress },
    iframe: { scalesPageToFit: true }
  }), [handleLinkPress])

  return (
    <RenderHTMLConfigProvider
      defaultTextProps={defaultTextProps}
      renderers={renderers}
      renderersProps={renderersProps}
      {...htmlConfig}
    >
      {children}
    </RenderHTMLConfigProvider>
  )
}

const HyloHTML = React.memo(
  function ({ html }) {
    const { width: contentWidth } = useWindowDimensions()

    return (
      <RenderHTMLSource
        source={{ html: wrapInHTMLDoc(html) }}
        contentWidth={contentWidth}
      />
    )
  }
)

export default HyloHTML
