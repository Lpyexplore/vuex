import { forEachValue } from '../util.js'

// 定义了Vuex中的 Module 类，包含了state、mutations、getters、actions、modules
export default class Module {
  constructor (rawModule, runtime) {
    this.runtime = runtime
    
    this._children = Object.create(null)   // 创建一个空对象，用于存放当前模块的子模块
    
    this._rawModule = rawModule         // 当前模块的一些信息，例如：state、mutations、getters、actions、modules
    const rawState = rawModule.state    // 1. 函数类型 => 返回一个obj对象; 2. 直接获取到obj对象

    // 存储当前模块的state状态
    this.state = (typeof rawState === 'function' ? rawState() : rawState) || {}   
  }

  // 判断该模块是否定义了namespaced，定义了则返回true; 否则返回false
  get namespaced () {
    return !!this._rawModule.namespaced
  }

  // 添加子模块，名称为key
  addChild (key, module) {
    this._children[key] = module
  }

  // 移除名称为key的子模块
  removeChild (key) {
    delete this._children[key]
  }

  // 获取名称为key的子模块
  getChild (key) {
    return this._children[key]
  }

  // 是否存在名称为key的子模块
  hasChild (key) {
    return key in this._children
  }

  update (rawModule) {
    this._rawModule.namespaced = rawModule.namespaced
    if (rawModule.actions) {
      this._rawModule.actions = rawModule.actions
    }
    if (rawModule.mutations) {
      this._rawModule.mutations = rawModule.mutations
    }
    if (rawModule.getters) {
      this._rawModule.getters = rawModule.getters
    }
  }

  // 遍历当前模块的所有子模块，并执行回调操作
  forEachChild (fn) {
    forEachValue(this._children, fn)
  }

  // 遍历当前模块的所有getters，并执行回调操作
  forEachGetter (fn) {
    if (this._rawModule.getters) {
      forEachValue(this._rawModule.getters, fn)
    }
  }

  // 遍历当前模块的所有actions，并执行回调操作
  forEachAction (fn) {
    if (this._rawModule.actions) {
      forEachValue(this._rawModule.actions, fn)
    }
  }

  // 遍历当前模块的所有mutations，并执行回调操作
  forEachMutation (fn) {
    if (this._rawModule.mutations) {
      forEachValue(this._rawModule.mutations, fn)
    }
  }
}
