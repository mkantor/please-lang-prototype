import either from '@matt.kantor/either'
import { makeObjectNode } from '../object-node.js'
import { type SemanticGraph } from '../semantic-graph.js'
import { types } from '../type-system.js'
import {
  preludeFunctionArity1,
  preludeFunctionArity2,
} from './stdlib-utilities.js'

type BooleanNode = 'true' | 'false'
const nodeIsBoolean = (node: SemanticGraph): node is BooleanNode =>
  node === 'true' || node === 'false'

const booleanNodeToBoolean = (node: BooleanNode): boolean => node === 'true'

export const boolean = {
  type: makeObjectNode({ 0: '@union', 1: { 0: 'false', 1: 'true' } }),
  is: preludeFunctionArity1(
    ['boolean', 'is'],
    {
      parameter: types.something,
      return: types.boolean,
    },
    argument => either.makeRight(nodeIsBoolean(argument) ? 'true' : 'false'),
  ),
  not: preludeFunctionArity1(
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
  and: preludeFunctionArity2(
    ['boolean', 'and'],
    {
      parameter: types.boolean,
      return: types.boolean,
    },
    {
      parameter: types.boolean,
      return: types.integer,
    },
    argument2 => {
      if (!nodeIsBoolean(argument2)) {
        return either.makeLeft({
          kind: 'panic',
          message: 'argument was not a boolean',
        })
      } else {
        return either.makeRight(argument1 => {
          if (!nodeIsBoolean(argument1)) {
            return either.makeLeft({
              kind: 'panic',
              message: 'argument was not a boolean',
            })
          } else {
            return either.makeRight(
              String(
                booleanNodeToBoolean(argument1) &&
                  booleanNodeToBoolean(argument2),
              ),
            )
          }
        })
      }
    },
  ),
  or: preludeFunctionArity2(
    ['boolean', 'or'],
    {
      parameter: types.boolean,
      return: types.boolean,
    },
    {
      parameter: types.boolean,
      return: types.integer,
    },
    argument2 => {
      if (!nodeIsBoolean(argument2)) {
        return either.makeLeft({
          kind: 'panic',
          message: 'argument was not a boolean',
        })
      } else {
        return either.makeRight(argument1 => {
          if (!nodeIsBoolean(argument1)) {
            return either.makeLeft({
              kind: 'panic',
              message: 'argument was not a boolean',
            })
          } else {
            return either.makeRight(
              String(
                booleanNodeToBoolean(argument1) ||
                  booleanNodeToBoolean(argument2),
              ),
            )
          }
        })
      }
    },
  ),
} as const
