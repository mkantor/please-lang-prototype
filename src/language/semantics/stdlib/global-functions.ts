import either from '@matt.kantor/either'
import option from '@matt.kantor/option'
import type { Atom } from '../../parsing.js'
import { isFunctionNode, makeFunctionNode } from '../function-node.js'
import {
  isObjectNode,
  lookupPropertyOfObjectNode,
  makeObjectNode,
  type ObjectNode,
} from '../object-node.js'
import { isSemanticGraph, type SemanticGraph } from '../semantic-graph.js'
import { types } from '../type-system.js'
import {
  makeFunctionType,
  makeObjectType,
  makeTypeParameter,
} from '../type-system/type-formats.js'
import {
  preludeFunction,
  serializeOnceAppliedFunction,
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

  // { 0: a => b, 1: b => c } => (a => c)
  flow: preludeFunction(
    ['flow'],
    {
      parameter: makeObjectType('', {
        0: makeFunctionType('', {
          parameter: A,
          return: B,
        }),
        1: makeFunctionType('', {
          parameter: B,
          return: C,
        }),
      }),
      return: makeFunctionType('', {
        parameter: A,
        return: C,
      }),
    },
    argument => {
      if (!isObjectNode(argument)) {
        return either.makeLeft({
          kind: 'panic',
          message: '`flow` must be given an object',
        })
      } else {
        const argument0 = lookupPropertyOfObjectNode('0', argument)
        const argument1 = lookupPropertyOfObjectNode('1', argument)
        if (option.isNone(argument0) || option.isNone(argument1)) {
          return either.makeLeft({
            kind: 'panic',
            message:
              "`flow`'s argument must contain properties named '0' and '1'",
          })
        } else if (
          !isFunctionNode(argument0.value) ||
          !isFunctionNode(argument1.value)
        ) {
          return either.makeLeft({
            kind: 'panic',
            message: "`flow`'s argument must contain functions",
          })
        } else {
          const function0 = argument0.value
          const function1 = argument1.value
          return either.makeRight(
            makeFunctionNode(
              {
                parameter: function0.signature.parameter,
                return: function1.signature.parameter,
              },
              serializeOnceAppliedFunction(
                ['flow'],
                makeObjectNode({ 0: function0, 1: function1 }),
              ),
              option.none,
              argument => either.flatMap(function0(argument), function1),
            ),
          )
        }
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
}
