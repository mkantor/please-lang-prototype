import either from '@matt.kantor/either'
import option from '@matt.kantor/option'
import assert from 'node:assert'
import { isFunctionNode } from '../../../semantics.js'
import { elaborationSuite } from '../test-utilities.test.js'

elaborationSuite('@function', [
  [
    { 0: '@function', 1: { 0: 'not a function' } },
    output => assert(either.isLeft(output)),
  ],
  [
    { 0: '@function', 1: { 0: 'x', 1: { 0: '@lookup', 1: { 0: 'x' } } } },
    elaboratedFunction => {
      assert(!either.isLeft(elaboratedFunction))
      assert(isFunctionNode(elaboratedFunction.value))
      assert.deepEqual(
        elaboratedFunction.value.parameterName,
        option.makeSome('x'),
      )
      assert.deepEqual(
        elaboratedFunction.value.serialize(),
        either.makeRight({
          0: '@function',
          1: { parameter: 'x', body: { 0: '@lookup', 1: { key: 'x' } } },
        }),
      )
    },
  ],
])
