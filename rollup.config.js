import typescript from 'rollup-plugin-typescript'
import builtins from 'rollup-plugin-node-builtins'
import { terser } from 'rollup-plugin-terser'

const input = 'src/scheduler.ts'
const output = { format: 'umd', name: 'Scheduler', sourcemap: true }

export default [
  {
    input,
    output: { ...output, file: 'dst/scheduler.js' },
    plugins: [typescript(), builtins()]
  },
  {
    input,
    output: { ...output, file: 'dst/scheduler.min.js' },
    plugins: [typescript(), builtins(), terser()]
  }
]
