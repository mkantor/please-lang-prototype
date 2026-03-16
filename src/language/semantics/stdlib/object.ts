import either from '@matt.kantor/either'
import { isObjectNode, makeObjectNode } from '../object-node.js'
import { types } from '../type-system.js'
import { preludeFunctionArity2 } from './stdlib-utilities.js'

export const object = {
  type: makeObjectNode({}),
  lookup: preludeFunctionArity2(
    ['object', 'lookup'],
    {
      // TODO
      parameter: types.atom,
      return: types.something,
    },
    {
      // TODO
      parameter: types.something,
      return: types.something,
    },
    key => {
      if (typeof key !== 'string') {
        return either.makeLeft({
          kind: 'panic',
          message: 'key was not an atom',
        })
      } else {
        return either.makeRight(argument => {
          if (!isObjectNode(argument)) {
            return either.makeLeft({
              kind: 'panic',
              message: 'argument was not an object',
            })
          } else {
            const propertyValue = argument[key]
            return either.makeRight(
              propertyValue === undefined ?
                makeObjectNode({ tag: 'none', value: makeObjectNode({}) })
              : makeObjectNode({ tag: 'some', value: propertyValue }),
            )
          }
        })
      }
    },
  ),
} as const
