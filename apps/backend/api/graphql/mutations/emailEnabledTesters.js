import { GraphQLError } from 'graphql'

export async function addEmailEnabledTester (adminUserId, userId) {
  if (!(await Admin.isTestAdmin(adminUserId))) {
    throw new GraphQLError('Unauthorized: Admin access required')
  }

  const tester = await EmailEnabledTester.create(userId)
  return tester
}

export async function removeEmailEnabledTester (adminUserId, userId) {
  if (!(await Admin.isTestAdmin(adminUserId))) {
    throw new GraphQLError('Unauthorized: Admin access required')
  }

  await EmailEnabledTester.delete(userId)
  return true
}

