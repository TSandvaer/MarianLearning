/**
 * Re-export from the shared stardust module for backward compatibility.
 *
 * The canonical implementation now lives in `_shared/stardust.ts`. This
 * file exists so that any remaining imports from `./stardust` within the
 * Math barrel continue to resolve.
 */
export {
  STARDUST_STORAGE_KEY,
  STARDUST_SCHEMA_VERSION,
  emptyStardust,
  loadStardust,
  writeStardust,
  _resetStardustWarn,
} from '../_shared/stardust'
export type { StardustState, StorageAdapter } from '../_shared/stardust'
