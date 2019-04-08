# typed-scheduler
A TaskScheduler module written in TypeScript for concurrency-limiting and rate-limiting

## [Docs][1] | [Github][2] | [npm][3]

[1]: https://patrickroberts.github.io/typed-scheduler
[2]: https://github.com/patrickroberts/typed-scheduler
[3]: https://www.npmjs.com/package/typed-scheduler

## Installing

```sh
$ npm i --save typed-scheduler
```

## Usage

```ts
import TaskScheduler from 'typed-scheduler'

// rate limit to 2 messages every second
// defaults to 3 priority classes
const scheduler = new TaskScheduler(2, 1000, 1)

// queue 120 messages synchronously
// scheduler will throttle to 2 messages / second
for (let i = 1; i <= 120; i++) {
  // schedule with normal priority
  scheduler.schedule(console.log, 1, `message ${i}`)
}
```

The `schedule()` method will return a promise that resolves when the scheduled function is executed. If the function throws an error, the promise will reject.

If the scheduled function is asynchronous, `schedule()` will return a promise that follows its completion.

### Priority

The second argument to `schedule()` is the priority with which to schedule the execution of the function. The scheduler will handle queued functions in FIFO order within each priority class, and higher priorities will always be handled before lower priorities. A lower value mean a higher priority.

### Concurrency and Rate

Note that the following schedulers do not behave identically.

```ts
// 2 tasks every second
new TaskScheduler(2, 1000)
// 1 task every half second
new TaskScheduler(1, 500)
```

The former will execute two functions without delay, then wait a full second after either completes before executing another function.

The latter will only execute one function at a time, then wait for half a second after it completes before executing another function.
