import { isObject } from './util'

export const mapState = normalizeNamespace((namespace, map) => {
    const res = {}
    normalizeMap(map).forEach(({key, value}) => {
        res[key] = function mappedState() {
            const store = this.$store
            let state = store.state
            let getters = store.getters
            
            if(namespace) {
                const module = getNamespaceModule(store, namespace)
                if(!module) return;
                state = module.context.state
                getters = module.context.getters
            }

            return typeof value === 'function'
                ? value.call(this, state, getters)
                : state[value]
        }
    })
    return res
})

export const mapMutations = normalizeNamespace((namespace, map) => {
    const res = {}
    normalizeMap(map).forEach(({key, value}) => {
        res[key] = function mappedMutations(...args) {
            const store = this.$store
            const commit = store.commit

            if(namespace) {
                const module = getNamespaceModule(store, namespace)
                if(!module) return;
                commit = module.context.commit
            }
            
            return typeof value === 'function'
                ? value.apply(this, [commit].concat(args))
                : commit.apply(this.$store, [value].concat(args))
        }
    })
    return res
})

export const mapActions = normalizeNamespace((namespace, map) => {
    const res = {}
    normalizeMap(map).forEach(({key, value}) => {
        res[key] = function mappedActions(...args) {
            const store = this.$store
            const dispatch = store.dispatch

            if(namespace) {
                const module = getNamespaceModule(store, namespace)

                if(!module) return;

                dispatch = module.context.dispatch
            }

            return typeof value === 'function'
                ? value.apply(this, [dispatch].concat(args))
                : dispatch.apply(this.$store, [value].concat(args))
        }
    })
    return res
})

export const mapGetters = normalizeNamespace((namespace, map) => {
    const res = {}
    normalizeMap(map).forEach(({key, value}) => {
        value = namespace + value
        res[key] = function mappedGetters() {
            return this.$store.getters[value]
        }
    })
})

export const createNamespacedHelpers = (namespace) => ({
    mapState: mapState.bind(null, namespace),
    mapMutations: mapMutations.bind(null, namespace),
    mapActions: mapActions.bind(null, namespace),
    mapGetters: mapGetters.bind(null, namespace)
})

function normalizeNamespace(fn) {
    return (namespace, map) => {
        if(typeof namespace !== 'string') {
            map = namespace
            namespace = ''
        } else {
            if(namespace.charAt(-1) !== '/') {
                namespace += '/'
            }
        }
        return fn(namespace, map)
    } 
}

function isValidMap(obj) {
    return Array.isArray(obj) || isObject(obj)
}

// 统一处理提交格式
function normalizeMap(map) {
    if(!isValidMap(map)) return [];
    
    return Array.isArray(map)
        ? map.map(key => ({key, value: key}))
        : map.map(key => ({key: key, value: map[key]}))
}

function getNamespaceModule(store, namespace) {
    return store.__modulesNamespaceMap[namespace] 
}