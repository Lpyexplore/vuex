import { isObject, forEachValue, isPromise, partial } from './util'
import ModuleCollection from './module/module-collection'

let Vue;

export class Store{
    constructor(options = {}) {
        const {
            plugins = [],
            strict = false
        } = options

        this.strict = strict
        this._committing = false
        this._mutations = {}
        this._actions = {}
        this.wrappedGetters = {}
        this.localGettersCache = {}
        this._module = new ModuleCollection(options)
        const state = this._module.root.state
        const store = this
        const { commit, dispatch } = this
        this.commit = function boundCommit(type, payload) {
            return commit.call(store, type, payload)
        }
        this.dispatch = function boundDispatch(type, payload) {
            return dispatch.call(store, type, payload)
        }
        
        installModule(store, [], this._module.root)

        resetVm(store, state)

        plugins.forEach(fn => fn(store))
    }

    commit(_type, _payload) {
        let { type, payload } = this.unifyObjectStyle(_type, _payload)
        const entry = this._mutations[type]
        entry.forEach(handler => handler(payload)) 
    }

    dispatch(_type, _payload) {
        let { type, payload } = this.unifyObjectStyle(_type, _payload)
        const entry = this._actions[type]
        const result = entry.length > 1
            ? Promise.all(entry.map(handler => handler(payload)))
            : entry[0](payload) 
        
        return new Promise((resolve, reject) => {
            result
            .then(
                res => resolve(res), 
                err => reject(err)
            )
        })
    }

    installModule(store, path, module) {
        let isRoot = !path.length
        let namespaced = this._module.getNamespaced(path)

        if(!isRoot) {
            const parent = this._module.getModule(path.slice(0, -1))
            let moduleName = path.slice(-1)
            Vue.set(parent.state, moduleName, module.state)
        }

        const local = module.context = this.makeLocalContext(store, path, namespaced, module)

        forEachValue(module._rawModule.mutations, (key, handler) => {
            let type = namespaced + key
            this.registerMutations(store, local, type, handler)
        })

        forEachValue(module._rawModule.actions, (key, handler) => {
            let type = namespaced + key
            this.registerActions(store, local, type, handler)
        })

        forEachValue(module._rawModule.getters, (key, handler) => {
            let type = namespaced + key
            this.registerGetters(store, local, type, handler)
        })

        forEachValue(module._children, (key, childModule) => {
            this.installModule(store, path.concat(key), childModule)
        })
    }
    
    resetVm(store, state) {
        let oldVm = store._vm
        const computed = {}
        store.getters = {}
        const getters = store.wrappedGetters
        forEachValue(getters, (key, getters) => {
            computed[key] = partial(getters, store)
            Object.defineProperty(store.getters, key, {
                get: () => store._vm[key]
            })
        })
        
        store._vm = new Vue({
            data() {
                return {
                    $$data: state
                }
            },
            computed
        })

        if(oldVm) {
            Vue.nextTick(() => oldVm.$destroy())
        }
    }

    makeLocal(store, path, namespaced) {
        const local = {
            commit: namespaced ? store.commit : function(_type, _payload, _options) {
                let { type, payload, options } = this.unifyObjectStyle(_type, _payload, _options)
                if(options && options.root) {
                    type = namespaced + type
                }
                return store.commit(type, payload)
            },
            dispatch: namespaced ? store.dispatch : function(_type, _payload, _options) {
                let { type, payload, options } = this.unifyObjectStyle(_type, _payload, _options)
                if(options && options.root) {
                    type = namespaced + type
                }
                return store.dispatch(type, payload)
            }
        }

        Object.defineProperties(local, {
            getters: {
                get: namespaced
                     ? store.getters
                     : this.localGetters(store, namespaced)
            },
            state: () => path.reduce((state, key) => {
                return state[key]
            }, store.state)
        })

        return local
    }

    localGetters(store, namespaced) {    // namespaced: first/second/
        if(!this.localGettersCache[namespaced]) {
            const getterProxy = {}
            let len = namespaced.length
            Object.keys(store.getters).forEach(type => { // type: first/second/getters1
                if(type.slice(0, len) === namespaced) return;
                let gettersName = type.slice(len)
                Object.defineProperty(getterProxy, gettersName, {
                    get: () => store.getters[gettersName]
                })
            })
            this.localGettersCache[namespaced] = getterProxy
        }

        return this.localGettersCache[namespaced]
    }

    registerMutations(store, local, type, handler) {
        const entry = store._mutations[type] || (store._mutations[type] = [])
        entry.push(function wrappedHandler(payload) {
            handler.call(store, local.state, payload)
        })
    }

    registerActions(store, local, type, handler) {
        const entry = store._actions[type] || (store._actions[type] = [])
        entry.push(function wrappedHandler(payload) {
            let res = handler.call(store, {
                commit: local.commit,
                dispatch: local.dispatch,
                state: local.state,
                getters: local.getters,
                rootState: store.state,
                rootGetters: store.getters
            }, payload)

            if(!isPromise(res)) res = Promise.resolve(res);
            
            return res
        })
    }

    registerGetters(store, local, type, handler) {
        if(store.wrappedGetters[type]) return;
        store.wrappedGetters[type] = function wrappedHandler(store) {
            return handler({
                state: local.state,
                getters: local.getters,
                rootState: store.state,
                rootGetters: store.getters
            })
        }
    }

    unifyObjectStyle(type, payload, options) {
        if(isObject(type) && type.type) {
            options = payload
            payload = type
            type = type.type
        }

        return { type, payload, options }
    }
    
}

export function install(_Vue) {
    if(Vue && Vue !== _Vue) Vue = _Vue;
    Vue.mixin({
        beforeCreate: function() {
            const options = this.$options
            if(options && options.store) {
                this.$store = typeof options.store === 'function'
                    ? options.store()
                    : options.store
            } else if(options.parent && options.parent.$store){
                this.$store = options.parent.$store
            }
        }
    })
}
