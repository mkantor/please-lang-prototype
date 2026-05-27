import either from '@matt.kantor/either'
import { makeUnionExpression } from '../expressions/union-expression.js'
import { objectNodeFromOrderedEntries } from '../object-node.js'
import { types } from '../type-system.js'
import { preludeFunctionArity1 } from './stdlib-utilities.js'

export const nothing = {
  type: makeUnionExpression(objectNodeFromOrderedEntries([])),

  is: preludeFunctionArity1(
    ['nothing', 'is'],
    {
      parameter: types.something,
      return: types.boolean,
    },
    _ => either.makeRight('false'),
  ),
} as const
