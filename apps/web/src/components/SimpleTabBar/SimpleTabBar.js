import { cn } from 'util/index'
import { capitalize } from 'lodash/fp'
import React from 'react'

import classes from './SimpleTabBar.module.scss'

export default function SimpleTabBar ({ currentTab, tabNames, selectTab }) {
  return (
    <ul className={classes.tabBar}>
      {tabNames.map(name =>
        <li
          key={name}
          className={cn(classes.tab, { [classes.tabActive]: name === currentTab })}
          onClick={() => selectTab(name)}
        >
          {capitalize(name)}
        </li>)}
    </ul>
  )
}
