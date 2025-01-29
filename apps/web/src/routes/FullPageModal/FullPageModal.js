import { cn } from 'util/index'
import React from 'react'
import { Route, Routes } from 'react-router-dom'
import isWebView from 'util/webView'

export default function FullPageModal ({
  confirmMessage, navigate, goToOnClose,
  content, children, narrow, fullWidth, leftSideBarHidden
}) {
  const multipleTabs = Array.isArray(content)

  if (isWebView()) {
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
          {!multipleTabs && (content || children)}
        </Routes>
      </div>
    )
  } else {
    return (
      <div className={cn('bg-midground h-full')}>
        {multipleTabs && (
          <div className={cn('w-full max-w-[750px] mx-auto px-8 py-8')}>
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
        {!multipleTabs && <div className={cn('w-full max-w-[750px] mx-auto px-8 py-8')}>{content || children}</div>}
      </div>
    )
  }
}
