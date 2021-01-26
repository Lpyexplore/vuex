# Vuex

## Vuex的基本使用

```js
// store/index.js
import Vuex from 'vuex'

const store = new Vuex.Sotre({
  state: {},
  getters: {},
  mutations: {},
  actions: {},
  modules: {}
})

export default store

// main.js
import Vue from 'vue'
import vuex from './store/index'

Vue.use(vuex)

new Vue({
  store,
  render: h => h(App)
}).$mount('#app')
```

### 一、state

功能：存储一些变量

#### 声明

```js
const store = new Vuex.Store({
  state: {
    conut: 1
  }
})
```

#### 使用

```html
// example.vue
<template></template>
<script>
	export default {
    // ...
    data() {
      return {
        count: this.$store.count    // 通过this.$store[变量名] 引用
      }
    }
  }
</script>
```

#### mapState

这是一种使用 `state` 的语法糖，先来看一个组件使用 `vuex` 中多个 `state` 变量的例子

```html
<template>
	<div>{{ a }}</div>
  <div>{{ b }}</div>
  <div>{{ c }}</div>
  <div>{{ d }}</div>
</template>

<script>
export default {
  date() {
    return {
      a: this.$store.state.a,
      b: this.$store.state.b,
      c: this.$store.state.c,
      d: this.$store.state.d,
    }
  }
}
</script>
```

例子中，使用到了 `vuex` 的 `state` 中的变量 `a`、`b` 、`c`、`d` ，因此在组件的 `data` 中多次调用 `this.$store.state` ，为了省去这些无用代码，可以使用辅助函数 `mapState`，看一下改善后的代码

```html
<template>
	<div>{{ a }}</div>
  <div>{{ b }}</div>
  <div>{{ c }}</div>
  <div>{{ d }}</div>
</template>

<script>
import { mapState } from 'vuex'
export default {
  // ...
  computed: {
    ...mapState({
      a: 'a',     // 第一种写法（字符串），变量a，映射到state里的变量a
      b: (state) => state.b,   // 第二种写法（箭头函数），返回state里的变量a，但注意此时的this指向的不是当前组件实例，因此不能通过 this.data[变量名]去获取当前组件的date中的变量
      c: function(state) {    // 第三种写法（普通函数），与第二种一样，区别在于后者this指向当前组件实例
        return state.c
      },
      d: 'd'
    })
  }
}
</script>
```

`mapState`也接受数组作为参数，具体使用方法如下

```html
<template>
	<div>{{ a }}</div>
  <div>{{ b }}</div>
  <div>{{ c }}</div>
  <div>{{ d }}</div>
</template>

<script>
import { mapState } from 'vuex'
export default {
  // ...
  computed: {
    ...mapState(['a', 'b', 'c', 'd'])  // 数组中的每个元素名称都映射的是state中相同名称的变量
  }
}
</script>
```

### 二、getters

功能：类似于计算属性

`getters` 的返回值会被缓存起来，只有当依赖的变量改变时，才会重新计算

#### 声明

简单的使用例子如下：

```js
const store = Vuex.Store({
  state: {
    nums: [3, 6, 10, 67, 87, 100, 4, 1]
  },
  getters: {
    filter: (state) => (limit) => {
      return state.nums.filter(num => num < limit)
    },
    single(state, getters, rootState, rootGetters) {
      return getters.filter(10) 
    }
  }
})
```

`getters` 可以接收两个参数，即 `state` 和 `getters`

#### 使用

```html
// example.vue
<template>{{ $store.getters.single }}</template>
<script>
	export default {
    
  }
</script>
```

#### mapGetters

与 `mapState` 作用类似

```html
<template></template>
<script>
import { mapGetters } from 'vuex'
export default {
  computed: {
    ...mapGetters({
      filter: 'filter',
      single: 'single'
    })
  }
}
</script>
```

或是传入数组作为参数

```html
<template></template>
<script>
import { mapGetters } from 'vuex'
export default {
  computed: {
    ...mapGetters(['filter', 'single'])
  }
}
</script>
```

### 三、mutations

功能：类似于 `methods` ；在 `vuex` 中，改变 `state` 中变量的操作都要经过 `mutations` ，并且 `mutaions` 中的方法都是同步方法

#### 声明

```js
const store = new Vuex.Store({
  date: {
    count: 1
  },
  mutations: {
    add(state, payload) {
      state.count += payload.num
    }
  }
})
```

`mutations` 接收两个参数，即 `state` 和 `payload` ; 后者表示的传入的参数，会根据调用方法的不同而变化

#### 使用

```html
<template></template>
<script>
export default {
  methods: {
    addOne() {
      this.$store.commit('add', 1)  // 此时，mutatons中的add方法的payload对应的就是1
    },
    addTwo() {
      this.$store.commit({  // 此时mutations中的add方法的payload对应的就是{type: 'add', num: 2}
        type: 'add',
        num: 2
      })
    }
  }
}
</script>
```

#### mapMutations

直接来看具体使用：

```html
<template></template>
<script>
import { mapMutations } from 'vuex'
export default {
  methods: {
    ...mapMutations({
      add: 'add'  // 当在当前组件调用 this.add(1)时，对应调用的就是this.$store.commit('add', 1)
    })
  }
}
</script>
```

同样也可以传入数组作为参数

```html
<template></template>
<script>
import { mapMutations } from 'vuex'
export default {
  methods: {
    ...mapMutations(['add'])
  }
}
</script>
```

### 四、actions

功能：与 `mutations` 相似，唯一区别就是 `actions` 支持的是异步操作

注：但是 `actions` 不能直接改变 `state` 中任何变量的值，因此仍然需要通过 `mutations` 去改变 `state`

#### 声明

```js
const store = new Vuex.Store({
  data: {
    count: 1
  },
  mutations: {
    addOne(state, payload) {
      state.count += payload
    }
  },
  actions: {
    AsyncAdd(context, products) {
      setTimeout(() => {
        context.commit('addOne', products)
      }, 1000)
    }
  }
})
```

`actions` 只接收两个参数，即 `context` 和 `products` ，前者可以访问 `state` 、`commit` 、`dispatch` 、`getters` 、`rootState` 、`rootGetters` ，后者就是接收到的一些参数

#### 使用

```html
<template></template>
<script>
export default {
  methods: {
    AsyncAddOne() {
      this.$store.dispatch('AsyncAdd', 1)
    }
  }
}
</script>
```

#### mapActions

直接来看使用例子：

```html
<template></template>
<script>
import { mapActions } from 'vuex'
export default {
  methods: {
    ...mapActions({
      AsyncAddOne: 'AsyncAdd'
    }),
    // 或者是
    ...mapActions(['AsyncAdd'])
  }
}
</script>
```

### 五、 Modules

... 未完待续