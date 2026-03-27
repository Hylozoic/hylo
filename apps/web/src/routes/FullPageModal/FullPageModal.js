import { cn } from 'util/index'
import React from 'react'
import { Route, Routes } from 'react-router-dom'
import { isLegacyWebView } from 'util/webView'
import { useTheme } from 'contexts/ThemeContext'

export default function FullPageModal ({
  confirmMessage, navigate, goToOnClose,
  content, children, narrow, fullWidth, leftSideBarHidden
}) {
  const multipleTabs = Array.isArray(content)
  const { navMode } = useTheme()
  const isTabNav = navMode === 'tabs'

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
    return (
      <div className={cn('bg-midground h-full')}>
        {multipleTabs && (
          <div className={cn('w-full mx-auto px-2 py-2 sm:px-8 sm:py-8', !isTabNav && 'max-w-[750px]')}>
            <Routes>
              {content.map(tab =>
                <Route
                  path={tab.path}
                  element={tab.render ? tab.render() : tab.component}
                  key={tab.path}
                />)}
            </Routes>
          </div>
        )}
        {!multipleTabs && <div className={cn('w-full mx-auto px-8 py-8', !isTabNav && 'max-w-[750px]')}>{content || children}</div>}
      </div>
    )
  }
}
