
// Toplevel API entrypoint to check auth & route to desired exporter flow based on parameters
module.exports = {
  groupData: async function (req, res) {
    const p = req.allParams()

    const user = await new User({ id: req.session.userId }).fetch({ columns: ['email'] })

    if (!p.groupId) {
      return res.status(400).send({ error: 'Please specify group ID' })
    }
    if (!p.datasets || !p.datasets.length) {
      return res.status(400).send({ error: 'Please specify datasets to export' })
    }

    // auth check
    let ok = false
    try {
      ok = await GroupMembership.hasResponsibility(req.session.userId, p.groupId, Responsibility.constants.RESP_ADMINISTRATION)
    } catch (err) {
      return res.status(422).send({ error: err.message ? err.message : err })
    }

    if (!ok) {
      return res.status(403).send({ error: 'No access' })
    }

    // process specified datasets
    if (p.datasets.includes('members')) {
      Queue.classMethod('ExportService', 'exportMembers', { groupId: p.groupId, userId: req.session.userId, email: user.get('email') })
      return res.ok({})
    }

    // got to the end and nothing output/exited, throw error
    throw new Error('Unknown datasets specified: ' + JSON.stringify(p.datasets))
  },

  userAccountData: async function (req, res) {
    try {
      const userId = req.session.userId
      if (!userId) {
        return res.status(401).send({ error: 'Unauthorized' })
      }

      // Queue the export job
      Queue.classMethod('ExportService', 'exportUserAccount', { userId })
      
      return res.ok({ message: 'Account export started. You will receive an email when it\'s ready.' })
    } catch (err) {
      return res.status(500).send({ error: err.message || 'Failed to start account export' })
    }
  }
}
