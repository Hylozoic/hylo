import { BOOTSTRAP_REPLAY } from 'store/constants'
import {
  bootstrapReplayEntries,
  getGroupReplayEntries,
  getGroupsMenuDataReplayEntries
} from './bootstrapReplayMeta'

export function replayBootstrapIntoOrm (bootstrap, dispatch) {
  if (!bootstrap) return

  bootstrapReplayEntries.forEach(({ getData, extractModel }) => {
    const data = getData(bootstrap)
    if (!data) return

    dispatch({
      type: BOOTSTRAP_REPLAY,
      payload: { data },
      meta: { extractModel }
    })
  })

  getGroupReplayEntries(bootstrap).forEach(({ data, extractModel }) => {
    if (!data) return

    dispatch({
      type: BOOTSTRAP_REPLAY,
      payload: { data },
      meta: { extractModel }
    })
  })

  getGroupsMenuDataReplayEntries(bootstrap).forEach(({ data, extractModel }) => {
    if (!data) return

    dispatch({
      type: BOOTSTRAP_REPLAY,
      payload: { data },
      meta: { extractModel }
    })
  })
}
