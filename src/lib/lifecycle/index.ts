/**
 * Public surface of the lifecycle module. Consumers import from here.
 */

export {
  getIsPageHidden,
  subscribeToVisibilityChange,
  _resetPageVisibilityForTests,
} from './pageVisibility'
export { useIsPageHidden } from './useIsPageHidden'
export { useHowlerSuspendOnHide } from './useHowlerSuspendOnHide'
export {
  useStorageSync,
  PROGRESS_STORAGE_KEY,
  SESSION_HISTORY_STORAGE_KEY,
} from './useStorageSync'
