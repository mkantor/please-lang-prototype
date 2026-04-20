import either from '@matt.kantor/either'
import { types } from '../type-system.js'
import { preludeFunctionArity1 } from './stdlib-utilities.js'

export const something = {
  // TODO: Add `type`.

  is: preludeFunctionArity1(
    ['something', 'is'],
    {
      parameter: types.something,
      return: types.boolean,
    },
    _ => either.makeRight('true'),
  ),
} as const
