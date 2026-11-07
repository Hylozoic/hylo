import FixedJSDOMEnvironment from 'jest-fixed-jsdom'

// The test environment's BroadcastChannel is Node's own, so a channel a test file opens
// stays open after that file's environment is gone. msw opens one when it loads, and
// ws.link() in mockGraphqlServer adds a listener to it that holds the whole environment.
// With every file run in one process, each file's environment then stayed in memory until
// the run ran out of heap. Close the channels a file opened when its environment is torn
// down, as a browser does when a page unloads.
export default class HyloJSDOMEnvironment extends FixedJSDOMEnvironment {
  constructor (...args) {
    super(...args)

    const openChannels = new Set()
    this.openBroadcastChannels = openChannels

    const NodeBroadcastChannel = this.global.BroadcastChannel
    this.global.BroadcastChannel = class BroadcastChannel extends NodeBroadcastChannel {
      constructor (...channelArgs) {
        super(...channelArgs)
        openChannels.add(this)
      }

      close () {
        openChannels.delete(this)
        return super.close()
      }
    }
  }

  async teardown () {
    for (const channel of this.openBroadcastChannels) channel.close()
    await super.teardown()
  }
}
