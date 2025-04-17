import either from '@matt.kantor/either'
import { type SemanticGraph } from '../semantic-graph.js'
import { types } from '../type-system.js'
import { preludeFunction } from './stdlib-utilities.js'

type BooleanNode = 'true' | 'false'
const nodeIsBoolean = (node: SemanticGraph): node is BooleanNode =>
  node === 'true' || node === 'false'

export const boolean = {
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
}
