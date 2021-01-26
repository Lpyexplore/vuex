export default function (Vue) {
  const version = Number(Vue.version.split('.')[0])

  // 2.x版本直接通过全局混入Vue.mixin的方式挂载store
  if (version >= 2) {
    Vue.mixin({ beforeCreate: vuexInit })
  } else {
    // 兼容1.x版本
    const _init = Vue.prototype._init
    Vue.prototype._init = function (options = {}) {
      options.init = options.init
        ? [vuexInit].concat(options.init)
        : vuexInit
      _init.call(this, options)
    }
  }

  // 将vuex混入到$options中
  function vuexInit () {
    // 获取当前组件的 $options
    const options = this.$options
    // 若当前组件的$options上已存在store，则将$options.store赋值给this.$store（一般是用于根组件的）
    if (options.store) {
      this.$store = typeof options.store === 'function'
        ? options.store()
        : options.store
    } 
    // 当前组件的$options上没有store，则获取父组件上的$store，即$options.parent.$store，并将其赋值给this.$store（一般用于子组件）
    else if (options.parent && options.parent.$store) {
      this.$store = options.parent.$store
    }
  }
}
