# typed-scheduler
A Scheduler written in TypeScript for concurrency-limiting and rate-limiting

## [Docs][docs] | [GitHub][gh] | [npm][npm] | [Yarn][yarn]
[![version](https://img.shields.io/npm/v/typed-scheduler.svg)][npm] [![npm bundle size](https://img.shields.io/bundlephobia/min/typed-scheduler.svg)][npm] [![devDependencies](https://img.shields.io/david/dev/patrickroberts/typed-scheduler.svg)][package] [![issues](https://img.shields.io/github/issues/patrickroberts/typed-scheduler.svg)][issues] [![node support](https://img.shields.io/node/v/typed-scheduler.svg)][package] [![code style](https://img.shields.io/badge/code_style-standard-brightgreen.svg)][standard] [![license](https://img.shields.io/npm/l/typed-scheduler.svg)][license]

## Table of Contents
- [Installing](#installing)
  - [npm](#npm)
  - [Yarn](#yarn)
- [Importing](#importing)
  - [ES Module](#es-module)
  - [CommonJS](#commonjs)
  - [Browser Global](#browser-global)
  - [AMD](#amd)
- [Usage](#usage)
  - [Example](#example)
  - [`priority`](#priority)
  - [`ready()` and `idle()`](#ready-and-idle)
  - [`concurrency` and `rate`](#concurrency-and-rate)
- [API](#api)
- [License](#license)

## Installing

### [npm][npm]
```sh
$ npm i --save typed-scheduler
```

### [Yarn][yarn]
```sh
$ yarn add typed-scheduler
```

## Importing
`typed-scheduler` is pre-bundled using the [UMD][umd] pattern to support the
following module formats.

### [ES Module][es]
```js
import Scheduler from 'typed-scheduler'
```

### [CommonJS][cjs]
```js
const Scheduler = require('typed-scheduler')
```

### [Browser Global][rmp]
```html
<script src="https://unpkg.com/typed-scheduler"></script>
```

### [AMD][amd]
```js
define(['typed-scheduler'], function (Scheduler) {

})
```

## Usage

### Example
```js
// rate limit to 2 messages every second
// defaults to 3 priorities
const scheduler = new Scheduler({ concurrency: 2, rate: 1000 })

// queue 120 messages synchronously
// scheduler will throttle to 2 messages per second
for (let i = 1; i <= 120; i++) {
  // schedule with normal priority
  scheduler.scheduleNormal(console.log, `message ${i}`)
}
```

### `priority`
The second argument of `schedule()` is used to set the priority class of the
scheduled function. The scheduler will handle scheduled functions in FIFO order
within each priority class, and higher priorities will always be handled before
lower priorities. A lower value means a higher priority.

### `ready()` and `idle()`
The output of this program demonstrates when each of these methods resolves.
```js
import Scheduler from 'typed-scheduler'

function print (...args) {
  console.log(`${(Date.now() / 1000).toFixed(3)}s`, ...args)
}

const scheduler = new Scheduler({ concurrency: 1, rate: 1000, priorities: 3 })

for (let i = 0; i < 3; i++) {
  for (let j = 0; j < 3; j++) {
    // interleave priority classes
    scheduler.schedule(
      () => print('task', i * 3 + j),
      j
    )
  }

  scheduler.ready(i).then(
    () => print(`priority ${i} ready`)
  )
}

scheduler.idle().then(
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

### `concurrency` and `rate`
Note that the following schedulers do not behave identically.
```js
// 2 tasks every second
new Scheduler({ concurrency: 2, rate: 1000 })
// 1 task every half second
new Scheduler({ concurrency: 1, rate: 500 })
```
Using the options `{ concurrency: 2, rate: 1000 }`, the scheduler will execute
two tasks without delay, then wait a full second after either completes before
executing another task.

Using `{ concurrency: 1, rate: 500 }` will only execute one task at a time,
then wait for half a second after it completes before executing another task.

## [API][docs]
The complete reference API is available on [GitHub Pages][docs].

## [License][license]
Copyright © 2019 Patrick Roberts

MIT License

[docs]: https://patrickroberts.github.io/typed-scheduler
[gh]: https://github.com/patrickroberts/typed-scheduler
[npm]: https://www.npmjs.com/package/typed-scheduler
[yarn]: https://yarnpkg.com/en/package/typed-scheduler
[umd]: https://github.com/umdjs/umd
[es]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/import
[cjs]: https://nodejs.org/api/modules.html#modules_modules
[rmp]: https://stackoverflow.com/questions/5647258/how-to-use-revealing-module-pattern-in-javascript
[amd]: https://requirejs.org/docs/whyamd.html#amd

[package]: https://github.com/patrickroberts/typed-scheduler/blob/master/package.json
[license]: https://github.com/patrickroberts/typed-scheduler/blob/master/LICENSE
[issues]: https://github.com/patrickroberts/typed-scheduler/issues
[standard]: https://standardjs.com
