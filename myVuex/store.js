import { isObject } from './util'
import ModuleCollection from './module/module-collection'

class Store{
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

        installModule(store, [], state, this._module.root)

        resetVm()

        plugins.forEach(fn => fn(store))
    }

    commit() {

    }

    dispatch() {

    }

    installModule(store, path, rootState, module) {
        let isRoot = !path.length
        let namespaced = this._module.getNamespaced(path)

        if(!isRoot) {
            const parent = this._module.getModule(path)
            let moduleName = path.slice(-1)
            Vue.set(parent.state, moduleName, module.state)
        }

        const local = module.context = this.makeLocalContext(store, path, namespaced, module)
    }
    
    resetVm() {

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

    unifyObjectStyle(type, payload, options) {
        if(isObject(type) && type.type) {
            options = payload
            payload = type
            type = type.type

        }

        return { type, payload, options }
    }
    
}
