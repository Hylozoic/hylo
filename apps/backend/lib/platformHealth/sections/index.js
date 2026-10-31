// Section order is the order the panel renders.
// Mark a metric `comparable: false` when its SQL reads current state (last-active times, settings,
// roles, account status, or notifications, which are deleted after about a month): its value for a
// past as-of date isn't what it was then, so the panel won't compare it with an earlier date.
import * as audience from './audience'
import * as networkAlive from './network_alive'
import * as missedConnections from './missed_connections'
import * as findingHome from './finding_home'
import * as beingAnswered from './being_answered'
import * as realWorldAction from './real_world_action'
import * as comingBack from './coming_back'
import * as stewards from './stewards'
import * as outbound from './outbound'
import * as trustNumbers from './trust_numbers'

export default [audience, networkAlive, missedConnections, findingHome, beingAnswered, realWorldAction, comingBack, stewards, outbound, trustNumbers]
