import {  } from '../util'

class Module{
    constructor(rawModule) {
        
        this._children = {}
        this._rawModule = rawModule
        const state = rawModule.state
        this.state = typeof state === 'function' ? state() : state
    }

    get namespaced() {
        return this._rawModule.namespaced ? true : false
    }

    getChild(key) {
        return this._children[key]
    }

    appendChild(key, module) {
        this._children[key] = module
    }
}

export default Module
