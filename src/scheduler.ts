import { EventEmitter } from 'events'
import { PromiseCompletionSource, delay, once, race } from './utils'
import {
  validator, assertType, assertInteger, assertMin, assertMax, assertArity
} from './validators'

/** @ignore */
const validateConcurrency = validator<number>(
  'concurrency',
  assertType('number'),
  assertInteger,
  assertMin(1),
  assertMax(Number.MAX_SAFE_INTEGER)
)

/** @ignore */
const validateRate = validator<number>(
  'rate',
  assertType('number'),
  assertMin(0)
)

/** @ignore */
const validatePriorities = validator<number>(
  'priorities',
  assertType('number'),
  assertInteger,
  assertMin(1),
  assertMax(2 ** 32, false)
)

/** @ignore */
const validateFn = (arity: number) => validator<Function>(
  'fn',
  assertType('function'),
  assertArity(arity)
)

/** @ignore */
const validateNormal = (priorities: number) => validator<number>(
  'normal',
  assertType('number'),
  assertInteger,
  assertMin(0),
  assertMax(priorities, false)
)

/** @ignore */
const validatePriority = (priorities: number) => validator<number>(
  'priority',
  assertType('number'),
  assertInteger,
  assertMin(0),
  assertMax(priorities, false)
)

/** Configuration options for [[Scheduler]] */
export interface SchedulerOptions {
  /**
   * Configures [[Scheduler.concurrency]].
   * @default Number.MAX_SAFE_INTEGER
   */
  concurrency: number
  /**
   * Configures [[Scheduler.rate]].
   * @default 0
   */
  rate: number
  /**
   * Configures [[Scheduler.priorities]].
   * @default 3
   */
  priorities: number
}

/** Defines a function and its parameters as arguments to [[schedule]]. */
export type Task<T, P extends any[]> = (...args: P) => Promise<T> | T

/**
 * Main export of [typed-scheduler](..). Performs asynchronous task scheduling
 * with options for priority levels, concurrency-limiting, and rate-limiting.
 */
export default class Scheduler {
  private _concurrency: number
  private _rate: number
  private _normal: number
  /**
   * Keeps an opaque reference to each [[Task]] that has been scheduled for
   * execution.
   */
  private queues: PromiseCompletionSource<void>[][]
  /**
   * Keeps a reference to each [[Task]] that is pending execution, or has
   * completed and but not yet satisfied the configured [[rate]].
   */
  private pending: Set<Promise<void>> = new Set()
  /**
   * Used internally for signalling state changes in the scheduler across
   * asynchronous contexts.
   */
  private propertyChanged: EventEmitter = new EventEmitter()

  /**
   * Creates a new instance of [[Scheduler]]. See [[SchedulerOptions]] for
   * default values.
   */
  public constructor (options: Partial<SchedulerOptions> = {}) {
    const {
      concurrency = Number.MAX_SAFE_INTEGER,
      rate = 0,
      priorities = 3
    } = options

    validateConcurrency(concurrency)
    validateRate(rate)
    validatePriorities(priorities)

    this._concurrency = concurrency
    this._rate = rate
    this._normal = Math.floor(priorities / 2)
    this.queues = Array(priorities)

    this.propertyChanged.setMaxListeners(0)

    // initializes asynchronous event loop of scheduler instance
    this.concurrencyLimit().catch(error => {
      console.error(error)
    })
  }

  /* public property accessors for configuring an instance of Scheduler */

  public get concurrency (): number {
    return this._concurrency
  }

  /**
   * Validates and configures the maximum amount of concurrent [[pending]]
   * tasks. Automatically signals the scheduler's event loop to immediately
   * process more tasks if the concurrency is increased. If the scheduler is
   * running at capacity and the concurrency is decreased, the concurrency
   * limit is temporarily violated until the required amount of existing
   * pending tasks have completed.
   */
  public set concurrency (value: number) {
    if (this._concurrency === value) return

    validateConcurrency(value)
    this._concurrency = value
    this.propertyChanged.emit('concurrency')
  }

  public get rate (): number {
    return this._rate
  }

  /**
   * Validates and configures the period of time for rate limiting.
   * Automatically signals all currently [[pending]] tasks to recalculate
   * remaining period of time based on the new value.
   */
  public set rate (value: number) {
    if (this._rate === value) return

    validateRate(value)
    this._rate = value
    this.propertyChanged.emit('rate')
  }

  public get normal (): number {
    return this._normal
  }

  /**
   * Validates and configures the normal priority level used for
   * the convenience method [[scheduleNormal]].
   */
  public set normal (value: number) {
    if (this._normal === value) return

    validateNormal(this.priorities)(value)
    this._normal = value
  }

  public get priorities (): number {
    return this.queues.length
  }

  /**
   * Validates and configures the number of priorities this scheduler uses.
   * Automatically resizes the [[queues]] based on the new value.
   */
  public set priorities (value: number) {
    if (this.queues.length === value) return

    validatePriorities(value)
    // constrain new priorities value by existing normal value
    validateNormal(value)(this.normal)

    if (value < this.queues.length) {
      const removed = this.queues.splice(value)
      const mininumPriorityClass = this.queues.pop() || []

      removed.forEach(priorityClass => {
        mininumPriorityClass.push(...priorityClass)
      })

      if (mininumPriorityClass.length > 0) {
        this.queues.push(mininumPriorityClass)
      }
    }

    this.queues.length = value
    this.propertyChanged.emit('priorities')
  }

  /* public API */

  /**
   * Returns a promise that resolves when the scheduled [[Task]] is executed.
   * If the function throws an error, the promise will reject. If the function
   * is asynchronous, the returned promise follows its completion.
   */
  public async schedule<T, P extends any[]> (
    fn: Task<T, P>,
    priority: number,
    ...params: P
  ): Promise<T> {
    validateFn(params.length)(fn)
    validatePriority(this.priorities)(priority)

    const pcs = new PromiseCompletionSource<void>()

    if (!this.queues[priority]) {
      this.queues[priority] = []
    }

    this.queues[priority].push(pcs)
    this.propertyChanged.emit('queues')

    await pcs

    const task = this.execute(fn, ...params)
    const dispose = async () => {
      await this.rateLimit()
      this.pending.delete(slot)
      this.propertyChanged.emit('pending')
    }
    const slot = task.then(dispose, dispose)

    this.pending.add(slot)
    this.propertyChanged.emit('pending')

    return task
  }

  /**
   * Convenience method to [[schedule]] a task at the highest priority.
   */
  public scheduleHigh<T, P extends any[]> (fn: Task<T, P>, ...params: P) {
    return this.schedule(fn, 0, ...params)
  }

  /**
   * Convenience method to [[schedule]] a task at the [[normal]] priority.
   */
  public scheduleNormal<T, P extends any[]> (fn: Task<T, P>, ...params: P) {
    return this.schedule(fn, this.normal, ...params)
  }

  /**
   * Convenience method to [[schedule]] a task at the lowest priority.
   */
  public scheduleLow<T, P extends any[]> (fn: Task<T, P>, ...params: P) {
    return this.schedule(fn, this.priorities - 1, ...params)
  }

  /**
   * Returns a promise that resolves when a [[Task]] scheduled at a given
   * priority would be executed next, if no other tasks with higher priorities
   * are scheduled in the same tick. The lowest priority is used by default, if
   * none is provided.
   */
  public async ready (priority: number = this.priorities - 1) {
    validatePriority(this.priorities)(priority)

    const processed = () => {
      const processing = this.queues.findIndex(Boolean)
      return processing < 0 || processing > priority
    }

    while (!processed()) {
      await once(this.propertyChanged, 'queues', processed)()
    }
  }

  /**
   * Returns a promise that resolves when every scheduled [[Task]] has
   * completed execution and the required period of time has passed to satisfy
   * the configured [[rate]] limit of the scheduler.
   */
  public async idle () {
    const processed = () => this.queues.findIndex(Boolean) < 0
    const inactive = () => this.pending.size === 0

    while (!processed() || !inactive()) {
      await once(this.propertyChanged, 'queues', processed)()
      await once(this.propertyChanged, 'pending', inactive)()
    }
  }

  /* internal methods for concurrency-limiting, executing, and rate-limiting */

  /**
   * The event loop of the scheduler signals queued tasks in prioritized order
   * whenever the configured [[concurrency]] and [[rate]] allow another
   * [[Task]] to [[execute]].
   */
  private async concurrencyLimit () {
    const available = () =>
      this.pending.size < this.concurrency &&
      this.queues.some(Boolean)

    while (true) {
      await race(
        once(this.propertyChanged, 'concurrency', available),
        once(this.propertyChanged, 'queues', available),
        once(this.propertyChanged, 'pending', available)
      )

      const index = this.queues.findIndex(Boolean)
      this.queues[index].shift()!.resolve()

      if (this.queues[index].length === 0) {
        delete this.queues[index]
      }

      this.propertyChanged.emit('queues')
    }
  }

  /**
   * Encapsulates a function execution in
   * a `Promise<T>` that follows its completion.
   */
  private async execute<T, P extends any[]> (
    fn: Task<T, P>,
    ...params: P
  ): Promise<T> {
    return fn(...params)
  }

  /**
   * Holds a reference to an executed [[Task]] until
   * the configured [[rate]] has been satisfied.
   */
  private async rateLimit () {
    let elapsed = 0

    while (elapsed < this.rate) {
      const start = Date.now()

      await race(
        delay(this.rate - elapsed),
        once(this.propertyChanged, 'rate')
      )

      const stop = Date.now()
      elapsed += stop - start
    }
  }
}
