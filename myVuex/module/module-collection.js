import Module from './module'
import { forEachValue } from '../util'

class ModuleCollection{
    constructor(rootModule) {
        this.register(rootModule, []) 
    }

    getModule(path) {
        const rootModule = this.root
        return path.reduce((module, key) => {
            return module.getChild(key)
        }, rootModule)
    }

    register(rawModule, path) {
        const module = new Module(rawModule)
        if(path.length) {
            this.root = module
        } else {
            const parent = this.getModule(path.slice(0, -1))
            parent.appendChild(path.slice(-1), module)
        }
        
        if(rawModule.modules) {
            forEachValue(rawModule.modules, (key, rawChildModule) => {
                this.register(rawChildModule, path.concat(key))
            })
        }
    }

    getNamespaced(path) {
        let module = this.root
        return path.reduce((namespaced, key) => {
            module = module.getChild(key)
            return namespaced + module.namespaced ? `${key}/` : ''
        }, '')
    }
}

export default ModuleCollection
