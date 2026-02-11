import either from '@matt.kantor/either'
import option from '@matt.kantor/option'
import type { Atom } from '../../parsing.js'
import { isFunctionNode, makeFunctionNode } from '../function-node.js'
import { isSemanticGraph } from '../is-semantic-graph.js'
import {
  isObjectNode,
  lookupPropertyOfObjectNode,
  type ObjectNode,
} from '../object-node.js'
import {
  stringifySemanticGraphForEndUser,
  type SemanticGraph,
} from '../semantic-graph.js'
import { isAssignable, types } from '../type-system.js'
import { showType } from '../type-system/show-type.js'
import {
  makeFunctionType,
  makeTypeParameter,
} from '../type-system/type-formats.js'
import { literalTypeFromSemanticGraph } from '../type-system/type-utilities.js'
import {
  preludeFunction,
  serializeOnceAppliedFunction,
  serializeTwiceAppliedFunction,
} from './stdlib-utilities.js'

const A = makeTypeParameter('a', { assignableTo: types.something })
const B = makeTypeParameter('b', { assignableTo: types.something })
const C = makeTypeParameter('b', { assignableTo: types.something })

type TaggedNode = ObjectNode & {
  readonly tag: Atom
  readonly value: SemanticGraph
}
const nodeIsTagged = (node: SemanticGraph): node is TaggedNode =>
  isObjectNode(node) &&
  node['tag'] !== undefined &&
  (typeof node['tag'] === 'string' ||
    (isSemanticGraph(node['tag']) && typeof node['tag'] === 'string')) &&
  node['value'] !== undefined

export const globalFunctions = {
  identity: preludeFunction(
    ['identity'],
    { parameter: A, return: A },
    either.makeRight,
  ),

  apply: preludeFunction(
    ['apply'],
    {
      // a => ((a => b) => b)
      parameter: A,
      return: makeFunctionType('', {
        parameter: makeFunctionType('', { parameter: A, return: B }),
        return: B,
      }),
    },
    argument =>
      either.makeRight(
        makeFunctionNode(
          {
            parameter: types.functionType,
            return: types.something,
          },
          serializeOnceAppliedFunction(['apply'], argument),
          option.none,
          functionToApply => {
            if (!isFunctionNode(functionToApply)) {
              return either.makeLeft({
                kind: 'panic',
                message: 'expected a function',
              })
            } else {
              return functionToApply(argument)
            }
          },
        ),
      ),
  ),

  // a => something => a
  // terminates with a `typeMismatch` error the value doesn't typecheck
  assume: preludeFunction(
    ['assume'],
    {
      parameter: A,
      return: makeFunctionType('', {
        parameter: types.something,
        return: A,
      }),
    },
    type =>
      either.makeRight(
        makeFunctionNode(
          {
            parameter: types.something,
            return: A,
          },
          serializeOnceAppliedFunction(['assume'], type),
          option.none,
          value =>
            either.flatMap(literalTypeFromSemanticGraph(value), valueAsType =>
              either.flatMap(literalTypeFromSemanticGraph(type), typeAsType => {
                if (
                  isAssignable({
                    source: valueAsType,
                    target: typeAsType,
                  })
                ) {
                  return either.makeRight(value)
                } else {
                  return either.makeLeft({
                    kind: 'typeMismatch',
                    message: `the value \`${stringifySemanticGraphForEndUser(
                      value,
                    )}\` is not assignable to the type \`${showType(
                      typeAsType,
                    )}\``,
                  })
                }
              }),
            ),
        ),
      ),
  ),

  // (b => c) => (a => b) => (a => c)
  flow: preludeFunction(
    ['flow'],
    {
      // TODO
      parameter: types.something,
      return: types.something,
    },
    secondFunction => {
      if (!isFunctionNode(secondFunction)) {
        return either.makeLeft({
          kind: 'panic',
          message: 'argument must be a function',
        })
      } else {
        return either.makeRight(
          makeFunctionNode(
            {
              // TODO
              parameter: types.something,
              return: types.something,
            },
            serializeOnceAppliedFunction(['flow'], secondFunction),
            option.none,
            firstFunction => {
              if (!isFunctionNode(firstFunction)) {
                return either.makeLeft({
                  kind: 'panic',
                  message: 'argument must be a function',
                })
              } else {
                return either.makeRight(
                  makeFunctionNode(
                    {
                      // TODO
                      parameter: types.something,
                      return: types.something,
                    },
                    serializeTwiceAppliedFunction(
                      ['flow'],
                      secondFunction,
                      firstFunction,
                    ),
                    option.none,
                    argument =>
                      either.flatMap(firstFunction(argument), secondFunction),
                  ),
                )
              }
            },
          ),
        )
      }
    },
  ),

  match: preludeFunction(
    ['match'],
    {
      // TODO
      parameter: types.something,
      return: types.something,
    },
    cases => {
      if (!isObjectNode(cases)) {
        return either.makeLeft({
          kind: 'panic',
          message: 'match cases must be an object',
        })
      } else {
        return either.makeRight(
          makeFunctionNode(
            {
              // TODO
              parameter: types.something,
              return: types.something,
            },
            serializeOnceAppliedFunction(['match'], cases),
            option.none,
            argument => {
              if (!nodeIsTagged(argument)) {
                return either.makeLeft({
                  kind: 'panic',
                  message: 'argument was not tagged',
                })
              } else {
                const relevantCase = lookupPropertyOfObjectNode(
                  argument.tag,
                  cases,
                )
                if (option.isNone(relevantCase)) {
                  return either.makeLeft({
                    kind: 'panic',
                    message: `case for tag '${argument.tag}' was not defined`,
                  })
                } else {
                  return !isFunctionNode(relevantCase.value)
                    ? either.makeRight(relevantCase.value)
                    : relevantCase.value(argument.value)
                }
              }
            },
          ),
        )
      }
    },
  ),
} as const
