import { Store, install } from './store.js'
import { mapState, mapMutations, mapGetters, mapActions, createNamespacedHelpers } from './helpers.js'
import createLogger from './plugins/logger.js'

export default {
  Store,
  install,
  version: '__VERSION__',
  mapState,
  mapMutations,
  mapGetters,
  mapActions,
  createNamespacedHelpers,
  createLogger
}

export {
  Store,
  install,
  mapState,
  mapMutations,
  mapGetters,
  mapActions,
  createNamespacedHelpers,
  createLogger
}
