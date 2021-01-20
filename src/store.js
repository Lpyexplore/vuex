import applyMixin from './mixin.js'
import devtoolPlugin from './plugins/devtool.js'
import ModuleCollection from './module/module-collection.js'
import { forEachValue, isObject, isPromise, assert, partial } from './util.js'

let Vue // bind on install

export class Store {
  constructor (options = {}) {
    // 避免二次安装，并且如果window上有Vue这个变量，则自动安装。注：这是用于在html文件中直接以script标签引入的情况
    if (!Vue && typeof window !== 'undefined' && window.Vue) {
      install(window.Vue)
    }

    if (__DEV__) {
      assert(Vue, `must call Vue.use(Vuex) before creating a store instance.`)
      assert(typeof Promise !== 'undefined', `vuex requires a Promise polyfill in this browser.`)
      assert(this instanceof Store, `store must be called with the new operator.`)
    }

    const {
      plugins = [],
      strict = false
    } = options

    /** 表示提交的状态，当通过mutations方法改变state时，该状态为true，state值改变完后，该状态变为false
    *   在严格模式下会监听state值的改变，当改变时，_committing为false时，会发出警告，即表明state值的改变不是经过mutations的
    */
    this._committing = false

    /**
     * 用于记录所有存在的actions方法名称（包括全局的和命名空间内的，且允许重复定义）
     * 
     * 具体格式入下：
     * this._actions = {
     *    actions1: [function handler() {...}],   // 注册全局的actions1方法
     *    second/actions2: [function handler() {...}],   // 注册在命名空间 second/ 上的actions2方法
     * }
     */
    this._actions = Object.create(null)         
    this._actionSubscribers = []       // 存放actions方法订阅的回调函数

    /**
     * 用于记录所有存在的的mutations方法名称（包括全局的和命名空间内的，且允许重复定义）
     * 
     * 具体格式如下：
     * this._mutations = {
     *    mutations1: [function handler() {...}],   // 注册在全局的mutations1
     *    second/mutations2: [function handler() {...}],  // 注册在命名空间 second/ 上的mutations2
     * }
     */
    this._mutations = Object.create(null)    
    
    /**
     * 收集所有模块包装后的的getters（包括全局的和命名空间内的，但不允许重复定义）
     * 
     * 具体格式如下：
     * this.wrappedGetters = {
     *    getters1: function handler() {...},   // 注册在全局的getters1
     *    second/getters2: function handler() {...},  // 注册在命名空间 second/ 上的getters2
     * }
     */
    this._wrappedGetters = Object.create(null)  

    this._modules = new ModuleCollection(options)  // 根据传入的options配置，注册各个模块，此时只是注册、建立好了各个模块的关系，已经定义了各个模块的state状态，但getters、mutations等方法暂未注册
    
    /**
     * 存储将namespaced设为true的模块，key: namespaced; value: 模块对象
     * 
     * 具体格式如下：
     * this._modulesNamespaceMap = {
     *    second/: moduleSecond,
     *    second/third: moduleFirst,
     * }
     */
    this._modulesNamespaceMap = Object.create(null)   

    this._subscribers = []    // 存放mutations方法订阅的回调
    this._watcherVM = new Vue()
    this._makeLocalGettersCache = Object.create(null)     // 本地的getters缓存

    // 将 dispatch 和 commit 方法绑定到 Store 的实例上，避免后续使用dispatch或commit时改变了this指向
    const store = this
    const { dispatch, commit } = this
    this.dispatch = function boundDispatch (type, payload) {
      return dispatch.call(store, type, payload)
    }
    this.commit = function boundCommit (type, payload, options) {
      return commit.call(store, type, payload, options)
    }

    // 判断store是否未严格模式。true: 所有的state都必须经过mutations来改变
    this.strict = strict

    // 将根模块的state作为store实例的state属性
    const state = this._modules.root.state

    // 从根模块开始，递归完善各个模块的信息
    installModule(this, state, [], this._modules.root)

    // 生成一个Vue实例去管理state状态，同时将getters交给computed处理
    resetStoreVM(this, state)

    // 依次调用传入的插件
    plugins.forEach(plugin => plugin(this))

    const useDevtools = options.devtools !== undefined ? options.devtools : Vue.config.devtools
    // 使用vue的开发插件
    if (useDevtools) {
      devtoolPlugin(this)
    }
  }

  get state () {
    return this._vm._data.$$state
  }

  set state (v) {
    if (__DEV__) {
      assert(false, `use store.replaceState() to explicit replace store state.`)
    }
  }

  commit (_type, _payload, _options) {
    // check object-style commit
    const {
      type,
      payload,
      options
    } = unifyObjectStyle(_type, _payload, _options)

    const mutation = { type, payload }
    const entry = this._mutations[type]    // 查找_mutations上是否有对应的方法
    // 查找不到则不执行任何操作
    if (!entry) {
      if (__DEV__) {
        console.error(`[vuex] unknown mutation type: ${type}`)
      }
      return
    }
    
    // 若有相应的方法，则执行
    this._withCommit(() => {
      entry.forEach(function commitIterator (handler) {
        handler(payload)
      })
    })

    this._subscribers
      .slice() // shallow copy to prevent iterator invalidation if subscriber synchronously calls unsubscribe
      .forEach(sub => sub(mutation, this.state))

    if (
      __DEV__ &&
      options && options.silent
    ) {
      console.warn(
        `[vuex] mutation type: ${type}. Silent option has been removed. ` +
        'Use the filter functionality in the vue-devtools'
      )
    }
  }

  dispatch (_type, _payload) {
    // check object-style dispatch
    const {
      type,
      payload
    } = unifyObjectStyle(_type, _payload)

    const action = { type, payload }
    const entry = this._actions[type]  // 查找_actions上是否有对应的方法
    // 查找不到则不执行任何操作
    if (!entry) {
      if (__DEV__) {
        console.error(`[vuex] unknown action type: ${type}`)
      }
      return
    }

    try {
      this._actionSubscribers
        .slice() // shallow copy to prevent iterator invalidation if subscriber synchronously calls unsubscribe
        .filter(sub => sub.before)
        .forEach(sub => sub.before(action, this.state))
    } catch (e) {
      if (__DEV__) {
        console.warn(`[vuex] error in before action subscribers: `)
        console.error(e)
      }
    }

    const result = entry.length > 1
      ? Promise.all(entry.map(handler => handler(payload)))
      : entry[0](payload)

    return new Promise((resolve, reject) => {
      result.then(res => {
        try {
          this._actionSubscribers
            .filter(sub => sub.after)
            .forEach(sub => sub.after(action, this.state))
        } catch (e) {
          if (__DEV__) {
            console.warn(`[vuex] error in after action subscribers: `)
            console.error(e)
          }
        }
        resolve(res)
      }, error => {
        try {
          this._actionSubscribers
            .filter(sub => sub.error)
            .forEach(sub => sub.error(action, this.state, error))
        } catch (e) {
          if (__DEV__) {
            console.warn(`[vuex] error in error action subscribers: `)
            console.error(e)
          }
        }
        reject(error)
      })
    })
  }

  // 新增mutations监听函数
  subscribe (fn, options) {
    return genericSubscribe(fn, this._subscribers, options)
  }

  // 新增actions监听函数
  subscribeAction (fn, options) {
    const subs = typeof fn === 'function' ? { before: fn } : fn
    return genericSubscribe(subs, this._actionSubscribers, options)
  }

  watch (getter, cb, options) {
    if (__DEV__) {
      assert(typeof getter === 'function', `store.watch only accepts a function.`)
    }
    return this._watcherVM.$watch(() => getter(this.state, this.getters), cb, options)
  }

  // 更新一下state
  replaceState (state) {
    this._withCommit(() => {
      this._vm._data.$$state = state
    })
  }

  // 注册模块
  registerModule (path, rawModule, options = {}) {
    if (typeof path === 'string') path = [path]

    if (__DEV__) {
      assert(Array.isArray(path), `module path must be a string or an Array.`)
      assert(path.length > 0, 'cannot register the root module by using registerModule.')
    }

    this._modules.register(path, rawModule)
    installModule(this, this.state, path, this._modules.get(path), options.preserveState)
    // reset store to update getters...
    resetStoreVM(this, this.state)
  }

  // 卸载模块
  unregisterModule (path) {
    if (typeof path === 'string') path = [path]

    if (__DEV__) {
      assert(Array.isArray(path), `module path must be a string or an Array.`)
    }

    this._modules.unregister(path)
    this._withCommit(() => {
      const parentState = getNestedState(this.state, path.slice(0, -1))
      Vue.delete(parentState, path[path.length - 1])
    })
    resetStore(this)
  }

  // 是否存在指定模块
  hasModule (path) {
    if (typeof path === 'string') path = [path]

    if (__DEV__) {
      assert(Array.isArray(path), `module path must be a string or an Array.`)
    }

    return this._modules.isRegistered(path)
  }

  // 热更新
  hotUpdate (newOptions) {
    this._modules.update(newOptions)
    resetStore(this, true)
  }

  // 执行mutations方法，执行前将_committing状态设为true，执行完以后，设为false
  _withCommit (fn) {
    const committing = this._committing
    this._committing = true
    fn()
    this._committing = committing
  }
}

// 统一封装mutations、actions的监听观察者函数
function genericSubscribe (fn, subs, options) {
  if (subs.indexOf(fn) < 0) {
    options && options.prepend
      ? subs.unshift(fn)
      : subs.push(fn)
  }
  return () => {
    const i = subs.indexOf(fn)
    if (i > -1) {
      subs.splice(i, 1)
    }
  }
}

// 重置store，即注册模块、挂载state等操作
function resetStore (store, hot) {
  store._actions = Object.create(null)
  store._mutations = Object.create(null)
  store._wrappedGetters = Object.create(null)
  store._modulesNamespaceMap = Object.create(null)
  const state = store.state
  // init all modules
  installModule(store, state, [], store._modules.root, true)
  // reset vm
  resetStoreVM(store, state, hot)
}

// 初始化vm，将getters
function resetStoreVM (store, state, hot) {
  const oldVm = store._vm

  store.getters = {}    // 在实例store上设置getters对象
  
  store._makeLocalGettersCache = Object.create(null)  // 清空本地缓存
  const wrappedGetters = store._wrappedGetters
  const computed = {}
  // 遍历getters，将每一个getter注册到store.getters，访问对应getter时会去vm上访问对应的computed
  forEachValue(wrappedGetters, (fn, key) => {
    computed[key] = partial(fn, store)
    Object.defineProperty(store.getters, key, {
      get: () => store._vm[key],
      enumerable: true // for local getters
    })
  })

  const silent = Vue.config.silent
  Vue.config.silent = true
  // 使用Vue实例来存储Vuex的state状态树，并利用computed去缓存getters返回的值
  store._vm = new Vue({
    data: {
      $$state: state
    },
    computed
  })
  Vue.config.silent = silent

  // 启用严格模式的监听警告
  if (store.strict) {
    enableStrictMode(store)
  }

  // 若存在旧的vm, 销毁旧的vm
  if (oldVm) {
    if (hot) {
      // 解除对旧的vm对state的引用
      store._withCommit(() => {
        oldVm._data.$$state = null
      })
    }
    Vue.nextTick(() => oldVm.$destroy())
  }
}

// 注册完善各个模块内的信息
function installModule (store, rootState, path, module, hot) {
  const isRoot = !path.length  // 是否为根模块
  const namespace = store._modules.getNamespace(path)  // 获取当前模块的路径，格式为：second/ 或 second/third/

  // 如果当前模块设置了namespaced 或 继承了父模块的namespaced，则在modulesNamespaceMap中存储一下当前模块
  if (module.namespaced) {
    if (store._modulesNamespaceMap[namespace] && __DEV__) {
      console.error(`[vuex] duplicate namespace ${namespace} for the namespaced module ${path.join('/')}`)
    }
    store._modulesNamespaceMap[namespace] = module
  }

  // 如果不是根模块，将当前模块的state注册到其父模块的state上
  if (!isRoot && !hot) {
    const parentState = getNestedState(rootState, path.slice(0, -1)) // 获取父模块的state
    const moduleName = path[path.length - 1]   // 当前模块的名称
    store._withCommit(() => {
      if (__DEV__) {
        if (moduleName in parentState) {
          console.warn(
            `[vuex] state field "${moduleName}" was overridden by a module with the same name at "${path.join('.')}"`
          )
        }
      }
      // 将当前模块的state注册在父模块的state上，并且是响应式的
      Vue.set(parentState, moduleName, module.state)
    })
  }

  // 设置当前模块的上下文context
  const local = module.context = makeLocalContext(store, namespace, path)

  // 注册模块的所有mutations
  module.forEachMutation((mutation, key) => {
    const namespacedType = namespace + key     // 例如：first/second/mutations1
    registerMutation(store, namespacedType, mutation, local)
  })

  // 注册模块的所有actions
  module.forEachAction((action, key) => {
    /**
     * actions有两种写法：
     * 
     * actions: {
     *    AsyncAdd (context, payload) {...},   // 第一种写法
     *    AsyncDelete: {                       // 第二种写法
     *      root: true,
     *      handler: (context, payload) {...}
     *    } 
     * }
     */
    const type = action.root ? key : namespace + key   // 判断是否需要在命名空间里注册一个全局的action
    const handler = action.handler || action          // 获取actions对应的函数
    registerAction(store, type, handler, local)   
  })

  // 注册模块的所有getters
  module.forEachGetter((getter, key) => {
    const namespacedType = namespace + key
    registerGetter(store, namespacedType, getter, local)
  })

  // 递归注册子模块
  module.forEachChild((child, key) => {
    installModule(store, rootState, path.concat(key), child, hot)
  })
}

// 若设置了命名空间则创建一个本地的commit、dispatch方法，否则将使用全局的store
function makeLocalContext (store, namespace, path) {
  const noNamespace = namespace === ''  

  const local = {
    dispatch: noNamespace ? store.dispatch : (_type, _payload, _options) => {
      const args = unifyObjectStyle(_type, _payload, _options)
      const { payload, options } = args
      let { type } = args

      if (!options || !options.root) {  // 若传入了第三个参数设置了root:true，则派发的是全局上对应的的actions方法
        type = namespace + type
        if (__DEV__ && !store._actions[type]) {
          console.error(`[vuex] unknown local action type: ${args.type}, global type: ${type}`)
          return
        }
      }

      return store.dispatch(type, payload)
    },

    commit: noNamespace ? store.commit : (_type, _payload, _options) => {
      const args = unifyObjectStyle(_type, _payload, _options)
      const { payload, options } = args
      let { type } = args

      if (!options || !options.root) {   // 若传入了第三个参数设置了root:true，则派发的是全局上对应的的mutations方法
        type = namespace + type
        if (__DEV__ && !store._mutations[type]) {
          console.error(`[vuex] unknown local mutation type: ${args.type}, global type: ${type}`)
          return
        }
      }

      store.commit(type, payload, options)
    }
  }

  /**
   * 若没有设定命名空间，则直接读取store.getters（store.getters已经挂载到vue实例的computed上了）;
   * 若设定了命名空间，则从本地缓存_makeLocalGettersCache中读取getters
   */
  Object.defineProperties(local, {
    getters: {
      get: noNamespace
        ? () => store.getters    
        : () => makeLocalGetters(store, namespace)
    },
    state: {
      get: () => getNestedState(store.state, path)
    }
  })

  return local
}

// 创建本地的getters缓存
function makeLocalGetters (store, namespace) {
  // 若缓存中没有指定的getters，则创建一个新的getters缓存到__makeLocalGettersCache中
  if (!store._makeLocalGettersCache[namespace]) {
    const gettersProxy = {}
    const splitPos = namespace.length
    Object.keys(store.getters).forEach(type => {
      // 如果store.getters中没有与namespace匹配的getters，则不进行任何操作
      if (type.slice(0, splitPos) !== namespace) return

      // 获取本地getters名称
      const localType = type.slice(splitPos)

      // 对getters添加一层代理
      Object.defineProperty(gettersProxy, localType, {
        get: () => store.getters[type],
        enumerable: true
      })
    })
    // 把代理过的getters缓存到本地
    store._makeLocalGettersCache[namespace] = gettersProxy
  }

  return store._makeLocalGettersCache[namespace]
}

// 注册mutations方法，接收两个参数：上下文中的state、传入的参数payload
function registerMutation (store, type, handler, local) {
  const entry = store._mutations[type] || (store._mutations[type] = [])  // 通过store._mutations 记录所有注册的mutations
  entry.push(function wrappedMutationHandler (payload) {
    handler.call(store, local.state, payload)
  })
}

// 注册actions方法，接收两个参数：context（包含了上下文中的dispatch方法、commit方法、getters方法、state）、传入的参数payload
function registerAction (store, type, handler, local) {
  const entry = store._actions[type] || (store._actions[type] = [])   // 通过store._actions 记录所有注册的actions
  entry.push(function wrappedActionHandler (payload) {
    let res = handler.call(store, {
      dispatch: local.dispatch,
      commit: local.commit,
      getters: local.getters,
      state: local.state,
      rootGetters: store.getters,
      rootState: store.state
    }, payload)
    // 若返回值不是一个promise对象，则包装一层promise，并将返回值作为then的参数
    if (!isPromise(res)) {
      res = Promise.resolve(res)
    }
    if (store._devtoolHook) {
      return res.catch(err => {
        store._devtoolHook.emit('vuex:error', err)
        throw err
      })
    } else {
      return res
    }
  })
}

// 注册getters
function registerGetter (store, type, rawGetter, local) {
  if (store._wrappedGetters[type]) {   // 若记录过getters了，则不再重复记录
    if (__DEV__) {
      console.error(`[vuex] duplicate getter key: ${type}`)
    }
    return
  }
  // 在store._wrappedGetters中记录getters
  store._wrappedGetters[type] = function wrappedGetter (store) {
    return rawGetter(
      local.state, // local state
      local.getters, // local getters
      store.state, // root state
      store.getters // root getters
    )
  }
}

// 在开发环境下，对严格模式下的vuex做一个警告打印
function enableStrictMode (store) {
  store._vm.$watch(function () { return this._data.$$state }, () => {
    if (__DEV__) {
      assert(store._committing, `do not mutate vuex store state outside mutation handlers.`)
    }
  }, { deep: true, sync: true })
}

// 获取到嵌套的模块中的state
function getNestedState (state, path) {
  return path.reduce((state, key) => state[key], state)
}

// 处理两种代码提交风格的情况，例如：1、this.$store.dispatch({type: 'add', count: 1}); 2、this.$store.dispatch('add', {count: 1})
function unifyObjectStyle (type, payload, options) {
  if (isObject(type) && type.type) {
    options = payload
    payload = type
    type = type.type
  }

  if (__DEV__) {
    assert(typeof type === 'string', `expects string as the type, but found ${typeof type}.`)
  }

  return { type, payload, options }
}

// 提供install方法
export function install (_Vue) {
  if (Vue && _Vue === Vue) {
    if (__DEV__) {
      console.error(
        '[vuex] already installed. Vue.use(Vuex) should be called only once.'
      )
    }
    return
  }
  Vue = _Vue
  applyMixin(Vue)
}
