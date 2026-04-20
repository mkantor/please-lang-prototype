import either from '@matt.kantor/either'
import { types } from '../type-system.js'
import { preludeFunctionArity1 } from './stdlib-utilities.js'

export const nothing = {
  // TODO: Add `type`.

  is: preludeFunctionArity1(
    ['nothing', 'is'],
    {
      parameter: types.something,
      return: types.boolean,
    },
    _ => either.makeRight('false'),
  ),
} as const
