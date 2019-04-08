# typed-scheduler
A Scheduler written in TypeScript for concurrency-limiting and rate-limiting

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

### Priority

The second argument of [[schedule]] is used to set the priority class of the scheduled function. The scheduler will handle scheduled functions in FIFO order within each priority class, and higher priorities will always be handled before lower priorities. A lower value mean a higher priority.

### [[ready]] and [[idle]]

```ts
import { performance } from 'perf_hooks'
import TaskScheduler from 'typed-scheduler'

const print = (...args) =>
  console.log(`${
    (performance.now() / 1000).toFixed(3)
  }s`, ...args)
const s = new TaskScheduler(1, 1000, 3)

for (let i = 0; i < 3; i++) {
  for (let j = 0; j < 3; j++) {
    // interleave priority classes
    s.schedule(
      () => print('task', i * 3 + j),
      j
    )
  }

  s.ready(i).then(
    () => print(`priority ${i} ready`)
  )
}

s.idle().then(
  () => print('scheduler idle')
)
```

The output of the program above demonstrates when each of these methods resolves.

```
0.111s task 0
1.116s task 3
2.118s task 6
2.118s priority 0 ready
3.120s task 1
4.121s task 4
5.121s task 7
5.122s priority 1 ready
6.122s task 2
7.123s task 5
8.126s task 8
8.126s priority 2 ready
9.127s scheduler idle
```

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
