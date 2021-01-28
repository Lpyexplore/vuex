export function forEachValue(obj, fn) {
    Object.keys(obj).forEach(key => fn(key, obj[key]))
}

export function isObject(obj) {
    return obj !== null && typeof obj === 'object'
}

export function isPromise(obj) {
    return obj && typeof obj.then === 'function'
}

export function partial(fn, payload) {
    return fn(payload)
}
