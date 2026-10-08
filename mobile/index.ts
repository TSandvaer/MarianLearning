// MUST stay the first import: installs core's storage (and applies a
// debug seed) before any module reads it. See ./src/platform/boot.ts.
import './src/platform/boot'
import { registerRootComponent } from 'expo'
import App from './src/App'

registerRootComponent(App)
