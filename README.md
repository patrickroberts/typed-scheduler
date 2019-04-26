# typed-scheduler
A Scheduler written in TypeScript for concurrency-limiting and rate-limiting

## [Docs][1] | [GitHub][2] | [npm][3]

[1]: https://patrickroberts.github.io/typed-scheduler
[2]: https://github.com/patrickroberts/typed-scheduler
[3]: https://www.npmjs.com/package/typed-scheduler

## Installing

```sh
$ npm i --save typed-scheduler
```

## Usage

```ts
import Scheduler from 'typed-scheduler'

// rate limit to 2 messages every second
// defaults to 3 priorities
const scheduler = new Scheduler({ concurrency: 2, rate: 1000 })

// queue 120 messages synchronously
// scheduler will throttle to 2 messages / second
for (let i = 1; i <= 120; i++) {
  // schedule with normal priority
  scheduler.scheduleNormal(console.log, `message ${i}`)
}
```

### Priority
The second argument of `schedule()` is used to set the priority class of the scheduled function. The scheduler will handle scheduled functions in FIFO order within each priority class, and higher priorities will always be handled before lower priorities. A lower value means a higher priority.

### `ready()` and `idle()`
The output of this program demonstrates when each of these methods resolves.

```ts
import { performance } from 'perf_hooks'
import Scheduler from 'typed-scheduler'

const print = (...args) =>
  console.log(`${
    (performance.now() / 1000).toFixed(3)
  }s`, ...args)
const s = new Scheduler({ concurrency: 1, rate: 1000, priorities: 3 })

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

Output

```
0.079s task 0
1.103s task 3
2.109s task 6
2.109s priority 0 ready
3.113s task 1
4.119s task 4
5.119s task 7
5.119s priority 1 ready
6.123s task 2
7.123s task 5
8.129s task 8
8.129s priority 2 ready
9.135s scheduler idle
```

### Concurrency and Rate
Note that the following schedulers do not behave identically.

```ts
// 2 tasks every second
new Scheduler({ concurrency: 2, rate: 1000 })
// 1 task every half second
new Scheduler({ concurrency: 1, rate: 500 })
```

The former will execute two tasks without delay, then wait a full second after either completes before executing another task.

The latter will only execute one task at a time, then wait for half a second after it completes before executing another task.
