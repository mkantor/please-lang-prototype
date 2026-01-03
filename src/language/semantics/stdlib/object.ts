import either from '@matt.kantor/either'
import option from '@matt.kantor/option'
import { makeFunctionNode } from '../function-node.js'
import { isObjectNode, makeObjectNode } from '../object-node.js'
import { types } from '../type-system.js'
import {
  preludeFunction,
  serializeOnceAppliedFunction,
} from './stdlib-utilities.js'

export const object = {
  type: makeObjectNode({}),
  lookup: preludeFunction(
    ['object', 'lookup'],
    {
      // TODO
      parameter: types.atom,
      return: types.something,
    },
    key => {
      if (typeof key !== 'string') {
        return either.makeLeft({
          kind: 'panic',
          message: 'key was not an atom',
        })
      } else {
        return either.makeRight(
          makeFunctionNode(
            {
              // TODO
              parameter: types.something,
              return: types.something,
            },
            serializeOnceAppliedFunction(['object', 'lookup'], key),
            option.none,
            argument => {
              if (!isObjectNode(argument)) {
                return either.makeLeft({
                  kind: 'panic',
                  message: 'argument was not an object',
                })
              } else {
                const propertyValue = argument[key]
                if (propertyValue === undefined) {
                  return either.makeRight(
                    makeObjectNode({
                      tag: 'none',
                      value: makeObjectNode({}),
                    }),
                  )
                } else {
                  return either.makeRight(
                    makeObjectNode({
                      tag: 'some',
                      value: propertyValue,
                    }),
                  )
                }
              }
            },
          ),
        )
      }
    },
  ),
} as const
