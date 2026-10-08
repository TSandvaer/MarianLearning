// Install the synchronous, SQLite-backed `globalThis.localStorage` BEFORE any
// app module runs, so boot-time reads (`useState(() => localStorage...)`)
// behave like the web app's. Entry point verified in
// node_modules/expo-sqlite/package.json "exports": "./localStorage/install".
import 'expo-sqlite/localStorage/install'

import { registerRootComponent } from 'expo'

import App from './App'

registerRootComponent(App)
