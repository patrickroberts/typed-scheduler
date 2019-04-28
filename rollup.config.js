import { ts, dts } from 'rollup-plugin-dts'
import builtins from 'rollup-plugin-node-builtins'
import { terser } from 'rollup-plugin-terser'
import pkg from './package.json'

const name = 'Scheduler'
const input = 'src/scheduler.ts'
const external = ['events']

export default [
  {
    input,
    output: { file: pkg.module, format: 'es' },
    plugins: [ts()],
    external
  },
  {
    input,
    output: { file: pkg.main, format: 'umd', name, sourcemap: true },
    plugins: [builtins(), ts()]
  },
  {
    input,
    output: { file: pkg.browser, format: 'umd', name, sourcemap: true },
    plugins: [builtins(), ts(), terser()]
  },
  {
    input,
    output: { file: pkg.types, format: 'es' },
    plugins: [dts()]
  }
]
