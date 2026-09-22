/**
 * Isolated Playwright (`yarn test:e2e:isolated` / CI) seeds `hylo_e2e` via
 * `seed-e2e-baseline.js`. Prefer `e2e-*` slugs from that seed over dump groups.
 */
export const ISOLATED_E2E = process.env.E2E_ISOLATED === '1'
