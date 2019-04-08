type Assertion<V> = (value: V, name: string) => void
type Typeof = 'string' | 'number' | 'bigint' | 'boolean' | 'symbol' | 'undefined' | 'object' | 'function'

export default function validator<V> (name: string, ...assertions: Assertion<V>[]) {
  return (value: V) => {
    assertions.forEach(assert => assert(value, name))
  }
}

export function assertType<V> (type: Typeof): Assertion<V> {
  const article = /^[aeiou]/.test(type) ? 'an' : 'a'

  return (value: V, name: string) => {
    if (typeof value !== type) {
      throw new TypeError(`${name} must be ${article} ${type}`)
    }
  }
}

export function assertInteger (value: number, name: string) {
  if (value % 1 !== 0) {
    throw new TypeError(`${name} must be an integer`)
  }
}

export function assertMin (minimum: number, inclusive: boolean = true) {
  const comparator = inclusive ? '≥' : '>'

  return (value: number, name: string) => {
    if (inclusive ? value < minimum : value <= minimum) {
      throw new RangeError(`${name} must be ${comparator} ${minimum}`)
    }
  }
}

export function assertMax (maximum: number, inclusive: boolean = true) {
  const comparator = inclusive ? '≤' : '<'

  return (value: number, name: string) => {
    if (inclusive ? value > maximum : value >= maximum) {
      throw new RangeError(`${name} must be ${comparator} ${maximum}`)
    }
  }
}

export function assertArity (arity: number, strict: boolean = false) {
  const comparator = strict ? '=' : '≤'

  return (value: Function, name: string) => {
    if (strict ? value.length !== arity : value.length > arity) {
      throw new RangeError(`arity of ${name} must be ${comparator} ${arity}`)
    }
  }
}
