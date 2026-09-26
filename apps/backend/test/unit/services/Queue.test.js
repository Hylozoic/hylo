import path from 'path'
import { dependencyOf } from '../../setup/helpers'
require('../../setup')

describe('Queue', () => {
  describe('.removeOldJobs', () => {
    let kue, originalRangeByState

    const fakeJob = (id, daysOld, removed) => ({
      id,
      created_at: String(Date.now() - daysOld * 86400000),
      remove: callback => {
        removed.push(id)
        callback()
      }
    })

    beforeEach(() => {
      kue = dependencyOf(
        path.resolve(__dirname, '../../../api/services/Queue.js'),
        require.resolve('kue')
      )
      originalRangeByState = kue.Job.rangeByState
    })

    afterEach(() => {
      kue.Job.rangeByState = originalRangeByState
    })

    it('removes failed jobs older than the given number of days and keeps newer ones', async () => {
      const removed = []
      let requested
      kue.Job.rangeByState = (state, from, to, order, callback) => {
        requested = { state, from, to, order }
        callback(null, [fakeJob(1, 8, removed), fakeJob(2, 6, removed), fakeJob(3, 30, removed)])
      }

      const count = await Queue.removeOldJobs('failed', 20000, 7)

      expect(requested).to.deep.equal({ state: 'failed', from: 0, to: 19999, order: 'asc' })
      expect(count).to.equal(2)
      expect(removed).to.deep.equal([1, 3])
    })
  })
})
