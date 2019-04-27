import { EventEmitter } from 'events'

export class PromiseCompletionSource<T> extends Promise<T> {
  static get [Symbol.species] () { return Promise }

  public resolve: (value?: T | PromiseLike<T>) => void
  public reject: (reason?: any) => void

  constructor () {
    let _resolve: (value?: T | PromiseLike<T>) => void = () => {}
    let _reject: (reason?: any) => void = () => {}

    super((resolve, reject) => {
      _resolve = resolve
      _reject = reject
    })

    this.resolve = _resolve
    this.reject = _reject
  }
}

export type PromiseCompletion<T> =
  (pcs?: PromiseCompletionSource<T>) => Promise<T>

export interface Timers {
  setTimeout (
    callback: (...args: any[]) => void,
    ms: number, ...args: any[]
  ): any
  clearTimeout (timeout: any): void
  setInterval (
    callback: (...args: any[]) => void,
    ms: number, ...args: any[]
  ): any
  clearInterval (timeout: any): void
}

export function delay (
  ms: number,
  timers: Timers = global
): PromiseCompletion<void> {
  return (pcs = new PromiseCompletionSource()) => {
    const handle = timers.setTimeout(pcs.resolve, ms)
    return pcs.finally(() => timers.clearTimeout(handle))
  }
}

export function once (
  emitter: EventEmitter,
  event: string,
  cond: () => boolean = () => true
): PromiseCompletion<void> {
  return (pcs = new PromiseCompletionSource()) => {
    const listener = () => { if (cond()) pcs.resolve() }
    emitter.on(event, listener)
    return pcs.finally(() => emitter.removeListener(event, listener))
  }
}

export function race (
  ...completions: PromiseCompletion<void>[]
): Promise<void> {
  const pcs = new PromiseCompletionSource<void>()
  completions.forEach(completion => completion(pcs))
  return pcs
}
