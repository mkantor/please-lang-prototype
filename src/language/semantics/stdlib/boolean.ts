import either from '@matt.kantor/either'
import option from '@matt.kantor/option'
import { makeFunctionNode } from '../function-node.js'
import { makeObjectNode } from '../object-node.js'
import { type SemanticGraph } from '../semantic-graph.js'
import { types } from '../type-system.js'
import {
  preludeFunction,
  serializeOnceAppliedFunction,
} from './stdlib-utilities.js'

type BooleanNode = 'true' | 'false'
const nodeIsBoolean = (node: SemanticGraph): node is BooleanNode =>
  node === 'true' || node === 'false'

export const boolean = {
  type: makeObjectNode({ 0: '@union', 1: { 0: 'false', 1: 'true' } }),
  is: preludeFunction(
    ['boolean', 'is'],
    {
      parameter: types.something,
      return: types.boolean,
    },
    argument => either.makeRight(nodeIsBoolean(argument) ? 'true' : 'false'),
  ),
  not: preludeFunction(
    ['boolean', 'not'],
    {
      parameter: types.boolean,
      return: types.boolean,
    },
    argument => {
      if (!nodeIsBoolean(argument)) {
        return either.makeLeft({
          kind: 'panic',
          message: 'argument was not a boolean',
        })
      } else {
        return either.makeRight(argument === 'true' ? 'false' : 'true')
      }
    },
  ),
  and: preludeFunction(
    ['boolean', 'and'],
    {
      parameter: types.boolean,
      return: types.boolean,
    },
    argument2 => {
      if (!nodeIsBoolean(argument2)) {
        return either.makeLeft({
          kind: 'panic',
          message: 'argument was not a boolean',
        })
      } else {
        return either.makeRight(
          makeFunctionNode(
            {
              parameter: types.boolean,
              return: types.integer,
            },
            serializeOnceAppliedFunction(['boolean', 'and'], argument2),
            option.none,
            argument1 => {
              if (!nodeIsBoolean(argument1)) {
                return either.makeLeft({
                  kind: 'panic',
                  message: 'argument was not a boolean',
                })
              } else {
                return either.makeRight(String(argument1 && argument2))
              }
            },
          ),
        )
      }
    },
  ),
  or: preludeFunction(
    ['boolean', 'or'],
    {
      parameter: types.boolean,
      return: types.boolean,
    },
    argument2 => {
      if (!nodeIsBoolean(argument2)) {
        return either.makeLeft({
          kind: 'panic',
          message: 'argument was not a boolean',
        })
      } else {
        return either.makeRight(
          makeFunctionNode(
            {
              parameter: types.boolean,
              return: types.integer,
            },
            serializeOnceAppliedFunction(['boolean', 'or'], argument2),
            option.none,
            argument1 => {
              if (!nodeIsBoolean(argument1)) {
                return either.makeLeft({
                  kind: 'panic',
                  message: 'argument was not a boolean',
                })
              } else {
                return either.makeRight(String(argument1 || argument2))
              }
            },
          ),
        )
      }
    },
  ),
} as const
