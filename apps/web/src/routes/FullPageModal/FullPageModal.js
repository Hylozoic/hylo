import { cn } from 'util/index'
import React from 'react'
import { Route, Routes } from 'react-router-dom'
import { isLegacyWebView } from 'util/webView'

export default function FullPageModal ({
  confirmMessage, navigate, goToOnClose,
  content, children, narrow, fullWidth, leftSideBarHidden
}) {
  const multipleTabs = Array.isArray(content)

  // DEPRECATED: New mobile app no longer longer renders differently for webview but uses standard layout
  if (isLegacyWebView()) {
    return (
      <div className='bg-background overflow-y-auto relative top-0 p-10'>
        <Routes>
          {multipleTabs && content.map(tab => (
            <Route
              path={tab.path}
              element={tab.render ? tab.render() : tab.component}
              key={tab.path}
            />
          ))}
        </Routes>
        {!multipleTabs && (content || children)}
      </div>
    )
  } else {
    // Let content grow and scroll via AuthLayout's center column so settings
    // (and other FullPageModal views) scroll independently of the left nav/menu.
    return (
      <div className={cn('bg-midground')}>
        {multipleTabs && (
          <div className={cn('w-full max-w-[750px] mx-auto px-2 py-2 sm:px-8 sm:py-8')}>
            <Routes>
              {content.map(tab => {
                const element = tab.render ? tab.render() : tab.component
                if (tab.path === '' || tab.path === undefined) {
                  return <Route index element={element} key='index' />
                }
                return (
                  <Route
                    path={tab.path}
                    element={element}
                    key={tab.path}
                  />
                )
              })}
            </Routes>
          </div>
        )}
        {!multipleTabs && <div className={cn('w-full max-w-[750px] mx-auto px-8 py-8')}>{content || children}</div>}
      </div>
    )
  }
}
