import either from '@matt.kantor/either'
import assert from 'node:assert'
import { types } from '../../../semantics.js'
import { isKeywordExpressionWithArgument } from '../../../semantics/expression.js'
import {
  getHoleTypeParameter,
  readHoleExpression,
} from '../../../semantics/expressions/hole-expression.js'
import { isObjectNode } from '../../../semantics/object-node.js'
import { elaborationSuite } from '../test-utilities.test.js'

const somethingTypeAsObject = {
  0: '@index',
  1: {
    object: {
      0: '@lookup',
      1: { key: 'something' },
    },
    query: { 0: 'type' },
  },
}

elaborationSuite('@hole', [
  [
    {
      0: '@hole',
      1: {
        name: 'a',
        constraint: { assignableTo: somethingTypeAsObject },
      },
    },
    result => {
      assert(either.isRight(result))
      const node = result.value
      const holeExpressionResult = readHoleExpression(node)
      assert(either.isRight(holeExpressionResult))
      const parameter = getHoleTypeParameter(holeExpressionResult.value)
      assert.deepEqual(parameter.name, 'a')
      assert.deepEqual(parameter.constraint.assignableTo, types.something)
    },
  ],

  [
    {
      pair: {
        0: '@union',
        1: {
          0: {
            0: '@hole',
            1: {
              name: 'same',
              constraint: {
                assignableTo: somethingTypeAsObject,
              },
            },
          },
          1: {
            0: '@hole',
            1: {
              name: 'same',
              constraint: {
                assignableTo: somethingTypeAsObject,
              },
            },
          },
        },
      },
    },
    result => {
      assert(either.isRight(result))
      const node = result.value
      assert(isObjectNode(node))
      const pair = node['pair']
      assert(pair)
      assert(isKeywordExpressionWithArgument('@union', pair))
      assert(isObjectNode(pair[1]))

      const first = pair[1]['0']
      const second = pair[1]['1']
      assert(first)
      assert(second)
      const firstHoleExpressionResult = readHoleExpression(first)
      assert(either.isRight(firstHoleExpressionResult))
      const secondHoleExpressionResult = readHoleExpression(second)
      assert(either.isRight(secondHoleExpressionResult))

      // They have unique identities despite sharing a name.
      const firstTypeParameter = getHoleTypeParameter(
        firstHoleExpressionResult.value,
      )
      const secondTypeParameter = getHoleTypeParameter(
        secondHoleExpressionResult.value,
      )
      assert.notDeepStrictEqual(
        firstTypeParameter.identity,
        secondTypeParameter.identity,
      )
    },
  ],
])
