import { EventEmitter } from 'events'

export type Cancelable = (resolve: () => void) => () => void

export function delay (ms: number): Cancelable {
  return resolve => {
    const handle = setTimeout(resolve, ms)

    return () => {
      clearTimeout(handle)
    }
  }
}

export function on (source: EventEmitter, name: string, cond: () => boolean = () => true): Cancelable {
  return resolve => {
    const listener = () => { if (cond()) resolve() }
    source.on(name, listener)

    return () => {
      source.off(name, listener)
    }
  }
}

export function when (promise: Promise<any>): Cancelable {
  return (resolve) => {
    promise.then(
      () => { resolve() },
      () => { resolve() }
    )

    return () => {
      resolve = () => { }
    }
  }
}

export default function race (...cancelables: Cancelable[]): Promise<void> {
  return new Promise(resolve => {
    const cancels = cancelables.map(
      cancelable => cancelable(
        () => {
          cancels.forEach(cancel => cancel())
          resolve()
        }
      )
    )
  })
}
