import either from '@matt.kantor/either'
import assert from 'node:assert'
import { elaborationSuite } from '../test-utilities.test.js'

elaborationSuite('@panic', [
  [
    { 0: '@panic' },
    output => {
      assert(either.isLeft(output))
      assert.deepEqual(output.value.kind, 'panic')
    },
  ],
  [
    { 0: '@panic', 1: 'blah' },
    output => {
      assert(either.isLeft(output))
      assert.deepEqual(output.value.kind, 'panic')
    },
  ],
  [
    { 0: '@panic', message: { a: { b: 'c' } } },
    output => {
      assert(either.isLeft(output))
      assert.deepEqual(output.value.kind, 'panic')
    },
  ],
])
