import typescript from 'rollup-plugin-typescript'
import builtins from 'rollup-plugin-node-builtins'
import { terser } from 'rollup-plugin-terser'

const { input, output, plugins } = {
  input: 'src/scheduler.ts',
  output: {
    format: 'umd',
    name: 'Scheduler',
    sourcemap: true
  },
  plugins: [
    typescript(),
    builtins()
  ]
}

export default [
  {
    input,
    output: {
      file: 'dst/scheduler.js',
      ...output
    },
    plugins
  },
  {
    input,
    output: {
      file: 'dst/scheduler.min.js',
      ...output
    },
    plugins: [
      ...plugins,
      terser()
    ]
  }
]
