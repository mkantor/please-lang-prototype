import either from '@matt.kantor/either'
import { makeObjectNode } from '../object-node.js'
import { types } from '../type-system.js'
import { preludeFunctionArity1 } from './stdlib-utilities.js'

export const nothing = {
  type: makeObjectNode({ 0: '@union', 1: {} }),

  is: preludeFunctionArity1(
    ['nothing', 'is'],
    {
      parameter: types.something,
      return: types.boolean,
    },
    _ => either.makeRight('false'),
  ),
} as const
