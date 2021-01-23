# 说明
本仓库用于阅读并记录 `Vuex` 源码，**注：** 所有对于源码的解读都在相应文件中加上了中文注释

非常建议一些能力有限并且从未阅读过成熟库源码的前端把 **Vuex源码** 作为自己第一个阅读源码的库，因为它本身代码量只有几百行，实现逻辑也非常易懂，我相信只要用心、肯花费时间，一定能将它的源码读懂的

当然，阅读源码的前提是你必须对这个库有一定的使用经验以及了解，否则就算开始阅读源码了，你也很难知道它在做什么  ➡️   [Vuex文档链接](https://vuex.vuejs.org/zh/)

刚开始做好阅读源码的准备，我给自己定下的期限是 `15`天

`Vuex`也是我第一次阅读源码的库，本仓库会记录下我阅读源码的全过程以及经验分享，希望可以帮助到大家～

# 进度（6/15）
**【2021年】** 每天阅读2小时（时间线中若未出现的日期，可能是因为其它事情耽搁了）

> **Start**   1月15日 ：熟悉了 `Modules` 的注册流程

>1月16日：了解了一下每个 `module` 注册 `state` 、`mutations` 、`actions`、`getters` 的大体流程

>1月17日：详细了解了 `vm` 对 `state` 、`getters` 的处理方式

>1月19日：大致了解完了全部的流程，但还有很多细节没明白，并攥写了部分源码的阅读文档

>1月20日：捋清了很多细节部分，同时更新了部分源码的阅读文档

>1月23日：编写了部分源码的阅读文档
# 源码解析

## 一、源码目录结构分析
整个 `Vuex` 的源码文件非常多，我们直接看最主要的文件，即 `src` 文件夹中的内容，结构示例如下：

```js
├── src
    ├── module    // 与模块相关的操作
    │   ├── module-collection.js   // 用于收集并注册根模块以及嵌套模块
    │   └── module.js   // 定义Module类，存储模块内的一些信息，例如: state...
    │
    ├── plugins   // 一些插件
    │   ├── devtool.js   // 开发调试插件
    │   └── logger.js    // 
    │
    ├── helpers.js       // 辅助函数，例如：mapState、mapGetters、mapMutations...
    ├── index.cjs.js     // commonjs 打包入口
    ├── index.js         // 入口文件
    ├── index.mjs        // es6 module 打包入口
    ├── mixin.js         // 将vuex实例挂载到全局Vue的$store上
    ├── store.js         // 核心文件，定义了Store类
    └── util.js          // 提供一些工具函数，例如: deepCopy、isPromise、isObject...
```



## 二、源码阅读

### 1. 查看工具函数

首先我个人觉得肯定是要看一下 `util.js` ，这里面存放的是源码中频繁用到的工具函数，所以我觉得要最先了解一下每个函数的作用是什么

```js
/**
 * Get the first item that pass the test
 * by second argument function
 *
 * @param {Array} list
 * @param {Function} f
 * @return {*}
 */

// 找到数组list中第一个符合要求的元素
export function find (list, f) {
  return list.filter(f)[0]
}

/**
 * 深拷贝
 * 
 * @param {*} obj
 * @param {Array<Object>} cache
 * @return {*}
 */
export function deepCopy (obj, cache = []) {
  // just return if obj is immutable value
  if (obj === null || typeof obj !== 'object') {
    return obj
  }

  // if obj is hit, it is in circular structure
  const hit = find(cache, c => c.original === obj)
  if (hit) {
    return hit.copy
  }

  const copy = Array.isArray(obj) ? [] : {}
  // put the copy into cache at first
  // because we want to refer it in recursive deepCopy
  cache.push({
    original: obj,
    copy
  })

  Object.keys(obj).forEach(key => {
    copy[key] = deepCopy(obj[key], cache)
  })

  return copy
}

// 遍历obj对象的每个属性的值
export function forEachValue (obj, fn) {
  Object.keys(obj).forEach(key => fn(obj[key], key))
}

// 判断是否为对象（排除null）
export function isObject (obj) {
  return obj !== null && typeof obj === 'object'
}

// 判断是否为Promise对象
export function isPromise (val) {
  return val && typeof val.then === 'function'
}

// 断言
export function assert (condition, msg) {
  if (!condition) throw new Error(`[vuex] ${msg}`)
}

// 保留原始参数的闭包函数
export function partial (fn, arg) {
  return function () {
    return fn(arg)
  }
}
```

每个函数的作用我都写上了注释，稍微阅读一下应该可以明白其作用

### 2. 入口文件

最主要的代码都在 `src` 目录下，所以以下提到的文件都是默认 `src` 目录下的文件

首先，肯定从入口文件 `index.js` 开始看，但能发现的是，还有 `index.cjs` 和 `index.mjs` ，这两者分别是 `commonjs` 和 `es6 module` 的打包入口，我们就不用管了

```js
import { Store, install } from './store'
import { mapState, mapMutations, mapGetters, mapActions, createNamespacedHelpers } from './helpers'
import createLogger from './plugins/logger'

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
```

从入口文件中可以看到，主要导出了 `Store` 类 、`install` 方法以及一些辅助函数（mapState、mapMutations、mapGetters...）

那么我们主要看的就是 `vuex` 的核心代码，即 `store.js` ，可以看到 `Store` 类就出自于这个文件

### 2. Store类的实现

整个 `Store` 类的主要逻辑都在它的构造函数 `constructor` 中，因此我们就从 `constructor` 中分步去捋逻辑、看代码

#### 2.1 存放类的状态

首先是定义了一些实例状态，用于存放模块、`mutations` 、`actions` 、`getters` 缓存等东西

```js
const {
  plugins = [],
  strict = false
} = options      // 生成Store类的入参

this._committing = false        // 表示提交的状态，当通过mutations方法改变state时，该状态为true，state值改变完后，该状态变为false; 在严格模式下会监听state值的改变，当改变时，_committing为false时，会发出警告，即表明state值的改变不是经过mutations的

this._actions = Object.create(null)  // 用于记录所有存在的actions方法名称（包括全局的和命名空间内的，且允许重复定义）      

this._actionSubscribers = []       // 存放actions方法订阅的回调函数

this._mutations = Object.create(null)  // 用于记录所有存在的的mutations方法名称（包括全局的和命名空间内的，且允许重复定义）

this._wrappedGetters = Object.create(null)  // 收集所有模块包装后的的getters（包括全局的和命名空间内的，但不允许重复定义）

this._modules = new ModuleCollection(options)  // 根据传入的options配置，注册各个模块，此时只是注册、建立好了各个模块的关系，已经定义了各个模块的state状态，但getters、mutations等方法暂未注册

this._modulesNamespaceMap = Object.create(null)   // 存储定义了命名空间的模块

this._subscribers = []    // 存放mutations方法订阅的回调

this._watcherVM = new Vue()  // 用于监听state、getters

this._makeLocalGettersCache = Object.create(null)   // getters的本地缓存
```

关于各个变量状态的作用都写在这了，其中只有 `this._modules = new ModuleCollection(option)` 执行了一些操作，其作用就是进行**模块递归收集**，根据 `ModuleCollection` 的来源，我们移步到 `./module/module-collection.js` 文件

##### 2.1.1 递归收集模块

在 `Module-collection.js` 文件中定义了 `ModuleCollection` 类，其作用就是通过递归遍历 `options` 入参，将每个模块都生成一个独立的 `Moudle`

这里先来熟悉一下 `options` 的结构，如下：

```js
import Vuex from 'vuex'

const options = {
  state: {...},
  getters: {...},
  mutations: {...},
  actions: {...},
  modules: {
    ModuleA: {
      state: {...},
      ...
      modules: {
        ModuleA1: {...}
      }
    },
    ModuleB: {
      state: {...},
      ...
      modules: {
        ModuleB1: {...}
      }
    }
  }
}

const store = new Vuex.Store(options)

export default store
```

可以看到传入的 `options` 整体可以看成一个根模块 `root` ，然后 `root` 的 `modules` 中嵌套着另外两个子模块：`ModuleA` 和`ModuleB` ，而 `ModuleA` 和`ModuleB` 内部也分别嵌套着一个子模块，分别为 `ModuleA1` 、`ModuleB1` 。这样就组成了一个模块树，因此 `ModuleCollection` 类的工作就是将保留原来的模块关系，将每个模块封装到一个 `Module` 类中

```js
export default class ModuleCollection {
  constructor (rawRootModule) {
    // 递归注册模块
    this.register([], rawRootModule, false)
  }
  
  // 根据路径顺序，从根模块开始递归获取到我们准备添加新的模块的父模块
  get (path) {
    return path.reduce((module, key) => {
      return module.getChild(key)
    }, this.root)
  }
  
  // 递归注册模块
  register (path, rawModule, runtime = true) {
    if (__DEV__) {
      assertRawModule(path, rawModule)
    }
    
    const newModule = new Module(rawModule, runtime)  // 初始化一个新的模块
    if (path.length === 0) {    // 当前没有别的模块
      this.root = newModule     // 则此模块为根模块
    } else {    // 有多个模块     
      const parent = this.get(path.slice(0, -1))   // 获取到新模块从属的父模块，所以是path.slice(0, -1)，最后一个元素就是我们要添加的子模块的名称
      parent.addChild(path[path.length - 1], newModule)    // 在父模块中添加新的子模块
    }

    if (rawModule.modules) {     // 如果有嵌套模块
      /**
       *  1. 遍历所有的子模块，并进行注册;
       *  2. 在path中存储除了根模块以外所有子模块的名称
       *  */ 
      forEachValue(rawModule.modules, (rawChildModule, key) => {
        this.register(path.concat(key), rawChildModule, runtime)
      })
    }
  }
}
```

**函数作用：**

1. `register(path, rawModule, runtime)`：注册新的模块，并根据模块的嵌套关系，将新模块添加作为对应模块的子模块

- path：表示模块嵌套关系。当前为根模块时，没有任何嵌套关系，此时 `path = []` ; 当前不时根模块时，存在嵌套关系，例如上述例子中的 `ModuleA1` ，它是 `ModuleA` 的子模块 ，而 `ModuleA` 又是根模块的子模块，此时 `path = ['ModuleA', 'ModuleA1']`
- rawModule：表示模块对象，此时是一个对象类型
- runtime：表示程序运行时



2. `get(path)`：根据传入的 `path` 路径，获取到我们想要的 `Module` 类

   

`ModuleCollection` 的构造函数中调用了 `register` 函数，前两个参数分别为：`[]` 、`rawRootModule` ，此时肯定是从根模块开始注册的，所以 `path` 里无内容，并且 `rawRootModule` 指向的是根模块



然后来看一下 `register` 函数里的逻辑。

1. 首先将当前要注册的模块生成一个 `Module` ，并将 `rawModule` 作为参数，用于存放 `Module` 的信息

2. 然后通过 `if(path.length === 0)` 判断是否为根模块，是的话就将 `this.root` 指向 `Module` ; 否则就跳到第3步
3. 判断当前模块不是根模块，就通过 `get` 函数找到当前模块的父模块，然后调用父模块中的 `addChild` 方法将当前模块添加到子模块中
4. 最后再判断当前模块是否还有嵌套的模块，有的话就重新回到第1步进行递归操作 ; 否则不做任何处理



按照上面的逻辑，就可以将所有的模块递归收集并注册好了，其中有一个 `Module` 类还没有具体提到，所以这里移步到 `./module/module.js` 

```js
import { forEachValue } from '../util'

// 定义了Vuex中的 Module 类，包含了state、mutations、getters、actions、modules
export default class Module {
  constructor (rawModule, runtime) {
    this.runtime = runtime
    
    this._children = Object.create(null)   // 创建一个空对象，用于存放当前模块的子模块
    
    this._rawModule = rawModule         // 当前模块的一些信息，例如：state、mutations、getters、actions、modules
    const rawState = rawModule.state    // 1. 函数类型 => 返回一个obj对象; 2. 直接获取到obj对象

    // 存储当前模块的state状态
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

  // 是否存在名称为key的子模块
  hasChild (key) {
    return key in this._children
  }
	
  // 将当前模块的命名空间更新到指定模块的命名空间中，并同时更新一下actions、mutations、getters的调用来源
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
```

来看一下刚才模块收集时，创建的 `Module` 类内部做了什么事情，同样的从 `constructor` 中开始看

`this._children` 是一个对象值，用于存放该模块嵌套的其它 `Module` 类 ;

`this._rawModule` 就是用于存放该模块内部的一些信息，例如：`state` 、`mutations` 、`actions` 、`getters` 、`moudles` ;

`this.state` 对应的就是 `this._rawModule` 中的 `state` ;

 这是整个构造函数中执行的操作，我们可以看到，在生成一个 `Module` 类的时候，其只定义了 `state` 属性，而 `mutations` 、`getters` 、`actions` 、`modules` 都是没有被定义的，即例如现在是无法通过 `Module.mutations` 获取到该模块所有的 `mutations` 方法，那么这些方法都是在何时被定义的呢？自然是等模块全部都收集完毕以后才进行的操作，因为 `vuex` 中的嵌套模块可能会存在命名空间 `namespaced` 

#### 2.2 注册模块

到此为止，各个模块的类都创建好了，那么继续回到 `./src/store.js` 的 `constructor` 构造函数中

```js
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

// 将根模块的state赋值给state变量
const state = this._modules.root.state
```

这段代码首先对 `Store` 实例上的 `dispatch` 和 `commit` 方法进行了一层包装，即通过 `call` 将这两个方法的作用对象指向当前的 `Store` 实例，这样就能防止后续我们操作时，出现 `this.$store.dispatch.call(obj, 1)` 类似的情况而报错

 `this.strict` 是用于判断是否是严格模式。因为 `vuex` 中，建议所有的 `state` 变量的变化都必须经过 `mutations` 方法，因为这样才能被 `devtool` 所记录下来，所以在严格模式下，未经过 `mutations` 而直接改变了 `state` 的值，开发环境下会发出警告⚠️

`const state = this._modules.root.state`  获取的是根模块的 `state` ，用于后续的一些操作

一切都准备就绪了，下面就开始为每个模块注册信息了

```js
// 从根模块开始，递归完善各个模块的信息
installModule(this, state, [], this._modules.root)
```

调用了 `installModule` 方法，并将 `store` 实例对象 、`state` 属性 、路径 、根模块对象依次作为参数进行传递

```js
// 注册完善各个模块内的信息
function installModule (store, rootState, path, module, hot) {
  const isRoot = !path.length  // 是否为根模块
  const namespace = store._modules.getNamespace(path)  // 获取当前模块的命名空间，格式为：second/ 或 second/third/

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
```

`const namespace = store._modules.getNamespace(path)` 是将路径 `path` 作为参数， 调用 `ModuleCollection` 类实例上的 `getNamespace` 方法来获取当前注册对象的命名空间的

```js
/**
* 根据模块是否有命名空间来设定一个路径名称
* 例如：A为父模块，B为子模块，C为子孙模块
* 1. 若B模块命名空间为second,C模块未设定命名空间时; C模块继承了B模块的命名空间，为 second/
* 2. 若B模块未设定命名空间, B模块命名空间为third; 则此时B模块继承的是A模块的命名空间，而C模块的命名空间路径为 third/
*/
getNamespace (path) {
  let module = this.root
  return path.reduce((namespace, key) => {
    module = module.getChild(key)   // 获取子模块
    return namespace + (module.namespaced ? key + '/' : '')
  }, '')
}
```

从这可以看出，未指定命名空间的模块会继承父模块的命名空间

```js
  // 如果当前模块设置了namespaced 或 继承了父模块的namespaced，则在modulesNamespaceMap中存储一下当前模块
if (module.namespaced) {
  if (store._modulesNamespaceMap[namespace] && __DEV__) {
    console.error(`[vuex] duplicate namespace ${namespace} for the namespaced module ${path.join('/')}`)
  }
  store._modulesNamespaceMap[namespace] = module
}
```

这段代码是将所有存在命名空间的模块记录在 `store._modulesNamespaceMap` 中，便于之后的辅助函数可以调用（这里还未提到辅助函数，可以先不管，到时候回头来看）

##### 2.2.1 注册模块的state

```js
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
```

这段代码主要是将非根模块的 `state` 挂载到父模块的 `state` 上

`const parentState = getNestedState(rootState, path.slice(0, -1))` 根据当前的模块路径，从根模块的 `state` 开始找，最终找到当前模块的父模块的 `state`，可以看一下 `getNestedState` 方法内部的具体实现

```js
// 获取到嵌套的模块中的state
function getNestedState (state, path) {
  return path.reduce((state, key) => state[key], state)
}
```

`const moduleName = path[path.length - 1]` 从路径 `path` 中将当前模块的名称提取出来

```js
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
```

这段代码中最主要的部分就是 `Vue.set(parentState, moduleName, module.state)` ，作用就是调用了 `Vue` 的 `set` 方法将当前模块的 `state` 响应式地添加到了父模块的 `state` 上，这是因为在之后我们会看到 `state` 会被放到一个新的 `Vue` 实例的 `data` 中，所以这里不得不使用 `Vue` 的 `set` 方法来响应式地添加

同样的，从这段代码中我们也可以知道了为什么平时在获取子模块上 `state` 的属性时，是通过 `this.$store.state.ModuleA.name` 这样的形式来获取的了

##### 2.2.2 生成模块调用上下文

```js
// 设置当前模块的上下文context
const local = module.context = makeLocalContext(store, namespace, path)
```

这行代码也可以说是非常核心的一段代码了，它根据命名空间为每个模块创建了一个属于该模块调用的上下文，并将该上下文赋值了给了该模块的 `context` 属性

接下来看一下这个上下文是如何创建的吧

```js
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
```

`local` 这个变量存储的就是一个模块的上下文。

先来看其第一个属性 `dispatch` ，当该模块没有设置命名空间时，调用该上下文的 `dispatch` 方法时会直接调用 `sotre.dispatch` ，即调用了根模块的 `dispatch` 方法 ; 而存在命名空间时，会先判断相应的命名空间，以此来决定调用哪个 `dispatch` 方法

`if (!options || !options.root)` 是判断调用 `dispatch` 方法时有没有传入第三个参数 `{root: true}` ，若有则表示调用全局根模块上对应的的 `dispatch` 方法

那么同样的，`local` 中的 `commit` 属性就类似于 `dispatch` ，这里就不多说了

然后最后通过 `Object.defineProperties` 方法对 `local` 的 `getters` 属性和 `state` 属性设置了一层获取代理，等后续对其访问时，才会进行处理。例如，访问 `getters` 属性时，先判断是否存在命名空间，若没有，则直接返回 `store.getters` ; 否则的话，根据命名空间创建一个本地的 `getters` 缓存，根据这个缓存来获取对应的 `getters` ，来看一下代码

```js
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
```

当存在命名空间时访问 `local.getters` ，首先会去 `store._makeLocalGettersCache` 查找是否有对应的 `getters` 缓存，若没有，则创建一个 `gettersProxy` ，在 `store.getters` 上找到对应的 `getters` ，然后用 `Object.defineProperty` 对 `gettersProxy` 做一层处理，即当访问 `local.getters.func` 时，相当于访问了 `store.getters['first/func']` ，这样做一层缓存，下一次访问该 `getters` 时，就不会重新遍历 `store.getters` 了 ; 若有缓存，则直接从缓存中获取

上下文已经创建好了，接下来就是注册 `mutations` 、`actions` 、`getters` 了

##### 2.2.3 注册模块的mutations

```js
// 注册模块的所有mutations
module.forEachMutation((mutation, key) => {
  const namespacedType = namespace + key     // 例如：first/second/mutations1
  registerMutation(store, namespacedType, mutation, local)
})
```



... 未完待续

# 最后

若本仓库对于 `Vuex` 源码阅读有任何错误的地方，欢迎大家给我提 `Issues`，一定虚心听取你们的指正

