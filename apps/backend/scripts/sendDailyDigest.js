#!/usr/bin/env node

/**
 * Send daily group digests for the previous 24 hours, for specific groups.
 *
 *   yarn digest:daily --group=123
 *   yarn digest:daily --group=123,456
 *   yarn digest:daily 123 456
 *   yarn digest:daily --dry-run --group=123
 */

require('@babel/register')
const skiff = require('../lib/skiff')
const { DateTime } = require('luxon')
const { red } = require('chalk')
const digest2 = require('../lib/group/digest2')
const { parseGroupIds } = require('../lib/group/digest2/util')

/**
 * Collect group ids from --group / --groups / -g and leftover positional args.
 */
const groupIdsFromArgv = (argv) => {
  const fromFlag = parseGroupIds(argv.group || argv.groups || argv.g)
  return parseGroupIds([...fromFlag, ...(argv._ || [])])
}

skiff.lift({
  start: function (argv) {
    const groupIds = groupIdsFromArgv(argv)
    if (groupIds.length === 0) {
      sails.log.error('Pass at least one group id: --group=123 or --group=123,456')
      skiff.lower()
      return
    }

    const endTime = DateTime.now()
    const startTime = endTime.minus({ hours: 24 })
    const dryRun = !!(argv['dry-run'] || argv.dryRun)

    sails.log.info(
      `Sending daily digests for group(s) ${groupIds.join(', ')} ` +
      `(${startTime.toISO()} → ${endTime.toISO()})${dryRun ? ' [dry run]' : ''}`
    )

    digest2.sendAllDigests('daily', { groupIds, startTime, endTime, dryRun })
      .then(results => {
        if (!results || results.length === 0) {
          sails.log.info('No digests sent (no matching groups, or no digest content)')
        } else {
          sails.log.info(`Sent digests: ${JSON.stringify(results)}`)
        }
        skiff.lower()
      })
      .catch(err => {
        sails.log.error(red(err.message))
        sails.log.error(err)
        skiff.lower()
      })
  }
})
