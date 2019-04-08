import { EventEmitter } from 'events'
import race, { delay, on, when } from './PromiseUtils'
import validator, { assertType, assertInteger, assertMin, assertMax, assertArity } from './Validators'

const validateConcurrency = validator(
  'concurrency',
  assertType('number'),
  assertInteger,
  assertMin(1),
  assertMax(Number.MAX_SAFE_INTEGER)
)

const validateRate = validator(
  'rate',
  assertType('number'),
  assertMin(0)
)

const validatePriorities = validator(
  'priorities',
  assertType('number'),
  assertInteger,
  assertMin(1),
  assertMax(2 ** 32, false)
)

const validateFn = (arity: number) => validator(
  'fn',
  assertType('function'),
  assertArity(arity)
)

const validatePriority = (priorities: number) => validator(
  'priority',
  assertType('number'),
  assertInteger,
  assertMin(0),
  assertMax(priorities, false)
)

export type Task<T, P extends any[]> = (...args: P) => T | Promise<T>

export default class TaskScheduler {
  private _concurrency: number
  private _rate: number
  private queues: symbol[][]
  private pending: Set<Promise<void>> = new Set()
  private slotPriority: Map<symbol, number> = new Map()
  private propertyChanged: EventEmitter = new EventEmitter()

  public constructor (concurrency = Number.MAX_SAFE_INTEGER, rate = 0, priorities = 3) {
    validateConcurrency(concurrency)
    validateRate(rate)
    validatePriorities(priorities)

    this._concurrency = concurrency
    this._rate = rate
    this.queues = Array(priorities)
  }

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
    }

    const promise = this.execute(fn, ...params)
    const task = promise
      .catch(() => { })
      .then(() => this.rateLimit())
      .then(() => { this.pending.delete(task) })

    this.pending.add(task)

    return promise
  }

  /* internal methods concurrency-limiting, executing, and rate-limiting */

  private async concurrencyLimit (slot: symbol): Promise<void> {
    // to dynamically resolve priority class while waiting for available slot
    const { slotPriority } = this

    for (
      let priority = slotPriority.get(slot) as number;
      this.pending.size >= this.concurrency ||
      this.queues[priority][0] === slot ||
      this.queues.slice(0, priority).some(queue => queue.length > 0);
      priority = slotPriority.get(slot) as number
    ) {
      await race(
        when(Promise.race(this.pending)),
        on(this.propertyChanged, 'concurrency', () => this.concurrency > this.pending.size)
      )
    }
  }

  protected async execute<T, P extends any[]> (fn: Task<T, P>, ...params: P): Promise<T> {
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
