import either from '@matt.kantor/either'
import { makeUnionExpression } from '../expressions/union-expression.js'
import { isFunctionNode } from '../function-node.js'
import {
  isObjectNode,
  makeObjectNode,
  type ObjectNode,
} from '../object-node.js'
import { type SemanticGraph } from '../semantic-graph.js'
import { types } from '../type-system.js'
import {
  makeFunctionType,
  makeTypeParameter,
} from '../type-system/type-formats.js'
import {
  preludeFunctionArity1,
  preludeFunctionArity2,
} from './stdlib-utilities.js'

const A = makeTypeParameter('a', { assignableTo: types.something })
const B = makeTypeParameter('b', { assignableTo: types.something })

export const option = {
  type: preludeFunctionArity1(
    ['option', 'type'],
    { parameter: A, return: types.option(A) },
    value =>
      either.makeRight(
        makeUnionExpression(
          makeObjectNode({
            0: makeObjectNode({
              tag: 'some',
              value,
            }),
            1: makeObjectNode({
              tag: 'none',
              value: {},
            }),
          }),
        ),
      ),
  ),

  none: makeObjectNode({ tag: 'none', value: makeObjectNode({}) }),

  make_some: preludeFunctionArity1(
    ['option', 'make_some'],
    { parameter: A, return: types.option(A) },
    value => either.makeRight(makeObjectNode({ tag: 'some', value })),
  ),

  // (a ~> b) ~> option(a) ~> option(b)
  map: preludeFunctionArity2(
    ['option', 'map'],
    {
      parameter: makeFunctionType('', { parameter: A, return: B }),
      return: makeFunctionType('', {
        parameter: types.option(A),
        return: types.option(B),
      }),
    },
    transform => {
      if (!isFunctionNode(transform)) {
        return either.makeLeft({
          kind: 'typeMismatch',
          message: '`map` expected a function',
        })
      } else {
        return either.makeRight(optionValue => {
          if (!nodeIsOptionLike(optionValue)) {
            return either.makeLeft({
              kind: 'typeMismatch',
              message: '`map` expected an option',
            })
          } else if (optionValue.tag === 'none') {
            return either.makeRight(optionValue)
          } else {
            return either.map(transform(optionValue.value), transformedValue =>
              makeObjectNode({ tag: 'some', value: transformedValue }),
            )
          }
        })
      }
    },
  ),

  // (a ~> option(b)) ~> option(a) ~> option(b)
  flat_map: preludeFunctionArity2(
    ['option', 'flat_map'],
    {
      parameter: makeFunctionType('', {
        parameter: A,
        return: types.option(B),
      }),
      return: makeFunctionType('', {
        parameter: types.option(A),
        return: types.option(B),
      }),
    },
    transform => {
      if (!isFunctionNode(transform)) {
        return either.makeLeft({
          kind: 'typeMismatch',
          message: '`flat_map` expected a function',
        })
      } else {
        return either.makeRight(optionValue => {
          if (!nodeIsOptionLike(optionValue)) {
            return either.makeLeft({
              kind: 'typeMismatch',
              message: '`flat_map` expected an option',
            })
          } else if (optionValue.tag === 'none') {
            return either.makeRight(optionValue)
          } else {
            return either.flatMap(
              transform(optionValue.value),
              transformedValue => {
                if (!nodeIsOptionLike(transformedValue)) {
                  return either.makeLeft({
                    kind: 'typeMismatch',
                    message: '`flat_map` function did not return an option',
                  })
                } else {
                  return either.makeRight(transformedValue)
                }
              },
            )
          }
        })
      }
    },
  ),
} as const

type OptionLikeNode = ObjectNode & {
  readonly tag: 'some' | 'none'
  readonly value: SemanticGraph
}

// TODO: Consider using a type system assignability check instead.
const nodeIsOptionLike = (node: SemanticGraph): node is OptionLikeNode =>
  isObjectNode(node) &&
  (node['tag'] === 'some' || node['tag'] === 'none') &&
  node['value'] !== undefined
