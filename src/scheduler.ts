import { EventEmitter } from 'events'
import race, { delay, on } from './utils'
import validator, { assertType, assertInteger, assertMin, assertMax, assertArity } from './validators'

/**
 * @ignore
 */
const validateConcurrency = validator(
  'concurrency',
  assertType('number'),
  assertInteger,
  assertMin(1),
  assertMax(Number.MAX_SAFE_INTEGER)
)

/**
 * @ignore
 */
const validateRate = validator(
  'rate',
  assertType('number'),
  assertMin(0)
)

/**
 * @ignore
 */
const validatePriorities = validator(
  'priorities',
  assertType('number'),
  assertInteger,
  assertMin(1),
  assertMax(2 ** 32, false)
)

/**
 * @ignore
 */
const validateFn = (arity: number) => validator(
  'fn',
  assertType('function'),
  assertArity(arity)
)

/**
 * @ignore
 */
const validatePriority = (priorities: number) => validator(
  'priority',
  assertType('number'),
  assertInteger,
  assertMin(0),
  assertMax(priorities, false)
)

type Task<T, P extends any[]> = (...args: P) => T | Promise<T>

class Scheduler {
  public constructor (concurrency = Number.MAX_SAFE_INTEGER, rate = 0, priorities = 3) {
    validateConcurrency(concurrency)
    validateRate(rate)
    validatePriorities(priorities)

    this._concurrency = concurrency
    this._rate = rate
    this.queues = Array(priorities)
  }

  private _concurrency: number
  private _rate: number
  private queues: symbol[][]
  private pending: Set<Promise<void>> = new Set()
  private slotPriority: Map<symbol, number> = new Map()
  private propertyChanged: EventEmitter = new EventEmitter().setMaxListeners(0)

  // priorities setter heavily abuses exotic behavior with empty slots
  private onPrioritiesChanged (value: number): void {
    if (value > this.queues.length) {
      // extends number of empty slots
      this.queues.length = value
    } else {
      // remove priority classes starting at new length
      const removed = this.queues.splice(value)
      // remove new minimum priority class or create one if it was empty slot
      const mininumPriorityClass = this.queues.pop() || []

      // only iterate non-empty slots in removed priority classes
      removed.forEach(
        priorityClass => mininumPriorityClass.push(...priorityClass)
      )
      // add all removed priority classes as new minimum priority class
      this.queues.push(mininumPriorityClass)

      // update slotPriority for slots from removed priority classes
      for (const [slot, priority] of this.slotPriority) {
        if (priority >= value) {
          this.slotPriority.set(slot, value - 1)
        }
      }
    }
  }

  /* public properties for configuring TaskScheduler */

  public get concurrency (): number {
    return this._concurrency
  }

  public set concurrency (value: number) {
    if (this._concurrency === value) return

    validateConcurrency(value)
    this.propertyChanged.emit('concurrency', this._concurrency = value)
  }

  public get rate (): number {
    return this._rate
  }

  public set rate (value: number) {
    if (this._rate === value) return

    validateRate(value)
    this.propertyChanged.emit('rate', this._rate = value)
  }

  public get priorities (): number {
    return this.queues.length
  }

  public set priorities (value: number) {
    if (this.queues.length === value) return

    validatePriorities(value)
    this.onPrioritiesChanged(value)
  }

  /* public API */

  /**
   * The `schedule()` method will return a promise that resolves when the scheduled function is executed. If the function throws an error, the promise will reject.
   * If the scheduled function is asynchronous, `schedule()` will return a promise that follows its completion.
   */
  public async schedule<T, P extends any[]> (fn: Task<T, P>, priority: number, ...params: P): Promise<T> {
    validateFn(params.length)(fn)
    validatePriority(this.priorities)(priority)

    const slot: unique symbol = Symbol('slot')

    if (!this.queues.hasOwnProperty(priority)) {
      this.queues[priority] = []
    }

    this.queues[priority].push(slot)
    this.slotPriority.set(slot, priority)

    await this.concurrencyLimit(slot)

    priority = this.slotPriority.get(slot) as number
    this.slotPriority.delete(slot)
    this.queues[priority].shift()

    if (this.queues[priority].length === 0) {
      delete this.queues[priority]
      this.propertyChanged.emit('queues')
    }

    const promise = this.execute(fn, params)
    const task = promise
      .catch(() => {})
      .then(() => this.rateLimit())
      .then(() => {
        this.pending.delete(task)
        this.propertyChanged.emit('pending')
      })

    this.pending.add(task)

    return promise
  }

  /**
   * The `ready()` method returns a promise that resolves when a function scheduled at a given priority will be executed immediately, if no other functions are scheduled with higher priorities in the same tick. If no priority is provided, the lowest priority is used by default.
   */
  public async ready (priority: number = this.priorities - 1): Promise<void> {
    validatePriority(this.priorities)(priority)

    const idle = () => this.queues
      .slice(0, priority + 1)
      .every(() => false)

    if (!idle()) {
      await race(
        on(this.propertyChanged, 'queues', idle)
      )
    }
  }

  /**
   * The `idle()` method returns a promise that resolves when all functions have completed execution and the window of time has passed to maximize the available concurrency of the scheduler.
   */
  public async idle (): Promise<void> {
    const empty = () => this.pending.size === 0

    while (this.queues.some(() => true)) {
      await this.ready()
      await race(
        on(this.propertyChanged, 'pending', empty)
      )
    }
  }

  /* internal methods concurrency-limiting, executing, and rate-limiting */

  private async concurrencyLimit (slot: symbol): Promise<void> {
    // to dynamically resolve priority class while waiting for available slot
    const { slotPriority } = this

    // give precedence to higher priority tasks scheduled in the same tick
    await Promise.resolve()

    for (
      let priority = slotPriority.get(slot) as number;
      this.pending.size >= this.concurrency ||
      this.queues[priority][0] !== slot ||
      this.queues.slice(0, priority).some(queue => queue.length > 0);
      priority = slotPriority.get(slot) as number
    ) {
      await race(
        on(this.propertyChanged, 'pending'),
        on(this.propertyChanged, 'concurrency', () => this.concurrency > this.pending.size)
      )

    }
  }

  protected async execute<T, P extends any[]> (fn: Task<T, P>, params: P): Promise<T> {
    return fn(...params)
  }

  private async rateLimit (): Promise<void> {
    for (let elapsed = 0, start: number, stop: number; elapsed < this.rate; elapsed += stop - start) {
      start = Date.now()

      await race(
        delay(this.rate - elapsed),
        on(this.propertyChanged, 'rate')
      )

      stop = Date.now()
    }
  }
}

export = Scheduler
