import { EventEmitter } from 'events'

type Cancelable = (resolve: () => void) => () => void

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
