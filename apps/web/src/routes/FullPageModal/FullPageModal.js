import { cn } from 'util'
import React, { useState } from 'react'
import { NavLink, Route, Routes } from 'react-router-dom'
import isWebView from 'util/webView'
import Icon from 'components/Icon'

import styles from './FullPageModal.module.scss'

export default function FullPageModal ({
  confirmMessage, setConfirmBeforeClose, navigate, goToOnClose,
  content, children, narrow, fullWidth, leftSideBarHidden,
  previousLocation
}) {
  const [entryLocation] = useState(previousLocation)

  const onClose = () => {
    const closeLocation = goToOnClose || entryLocation

    if (confirmMessage && window.confirm(confirmMessage)) {
      setConfirmBeforeClose(false)
      navigate(closeLocation)
    } else {
      navigate(closeLocation)
    }
  }

  const multipleTabs = Array.isArray(content)

  if (isWebView()) {
    return (
      <div className={styles.modalSettingsLayout}>
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
      <div className={cn(styles.modal, { [styles.fullWidth]: fullWidth })}>
        <div className={styles.content}>
          <div className={cn(styles.leftSidebar, { [styles.leftSideBarHidden]: leftSideBarHidden })}>
            <div className={cn(styles.leftSidebarFixed, { [styles.border]: multipleTabs })}>
              {multipleTabs && content.filter(tab => !!tab.name).map(tab => (
                <NavLink
                  to={tab.path}
                  end
                  replace
                  className={({ isActive }) => cn(styles.navLink, { [styles.active]: isActive })}
                  key={tab.path}
                >
                  {tab.name}
                </NavLink>
              ))}
              <Icon name='ArrowDown' className={styles.arrowDown} />
            </div>
          </div>
          {multipleTabs && (
            <div className={cn(styles.center, styles.narrow)}>
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
          {!multipleTabs && <div className={cn(styles.center, { [styles.narrow]: narrow })}>{content || children}</div>}
          <div className={styles.rightSidebar}>
            <div className={styles.rightSidebarInner}>
              <CloseButton onClose={onClose} />
            </div>
          </div>
        </div>
      </div>
    )
  }
}

export function CloseButton ({ onClose }) {
  return (
    <div className={styles.closeButton} onClick={onClose} role='button' aria-label='close'>
      <Icon name='Ex' className={styles.icon} />
    </div>
  )
}
