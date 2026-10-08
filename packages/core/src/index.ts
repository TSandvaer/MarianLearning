/**
 * `@marian/core`: the DOM-free logic shared by the web app and the React
 * Native app.
 *
 * Domain modules are imported by subpath (`@marian/core/progress`,
 * `@marian/core/math/distractors`, `@marian/core/wire/types`, ...). This
 * root entry only exposes the platform seams a host wires once at boot:
 *
 *   - `setKeyValueStore`: synchronous storage (web: window.localStorage)
 *   - `setApiBase`: origin of the /api functions (web: none, relative)
 *   - `setDayOffsetSource`: QA day offset (web: ?debug=1&dayOffset=N)
 *   - `setCloudSyncAuthSecretSource`: the progress-API secret
 *
 * The web host is `src/platform/web.ts`.
 */
export {
  getKeyValueStore,
  setKeyValueStore,
  type KeyValueStore,
} from './platform/keyValueStore'
export { apiUrl, setApiBase } from './platform/apiUrl'
export { setDayOffsetSource, type DayOffsetSource } from './progress/clock'
export {
  setCloudSyncAuthSecretSource,
  type CloudSyncAuthSecretSource,
} from './progress/cloudSync'
