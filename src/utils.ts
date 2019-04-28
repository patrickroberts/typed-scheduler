import { EventEmitter } from 'events'

export class PromiseCompletionSource<T> extends Promise<T> {
  static get [Symbol.species] () { return Promise }

  public resolve: (value?: T | PromiseLike<T>) => void
  public reject: (reason?: any) => void

  constructor () {
    const settle:
      Partial<Pick<PromiseCompletionSource<T>, 'resolve' | 'reject'>> = {}

    super((resolve, reject) => {
      settle.resolve = resolve
      settle.reject = reject
    })

    const { resolve, reject } =
      settle as Pick<PromiseCompletionSource<T>, 'resolve' | 'reject'>

    this.resolve = resolve
    this.reject = reject
  }
}

export type PromiseCompletion<T> =
  (pcs?: PromiseCompletionSource<T>) => Promise<T>

export function delay (ms: number): PromiseCompletion<void> {
  return (pcs = new PromiseCompletionSource()) => {
    const handle = setTimeout(pcs.resolve, ms)
    return pcs.finally(() => clearTimeout(handle))
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
