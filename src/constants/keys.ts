import { isEnvTruthy } from '../utils/envUtils.js'

let _cachedGrowthBookClientKey: string | null = null

// Lazy read so ENABLE_GROWTHBOOK_DEV from globalSettings.env (applied after
// module load) is picked up. USER_TYPE is a build-time define so it's safe.
export function getGrowthBookClientKey(): string {
  if (_cachedGrowthBookClientKey !== null) {
    return _cachedGrowthBookClientKey
  }

  // Allow override via environment variable to avoid hardcoded keys
  const envKey = process.env.GROWTHBOOK_CLIENT_KEY
  if (envKey) {
    _cachedGrowthBookClientKey = envKey
    return envKey
  }
  // Use the default key - USER_TYPE is user-controllable in open-source fork
  const result = 'sdk-zAZezfDKGoZuXXKe'
  _cachedGrowthBookClientKey = result
  return result
}
