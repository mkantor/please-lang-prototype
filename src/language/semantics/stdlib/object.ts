import either from '@matt.kantor/either'
import { isObjectNode, makeObjectNode } from '../object-node.js'
import { types } from '../type-system.js'
import { makeFunctionType } from '../type-system/type-formats.js'
import { preludeFunctionArity2 } from './stdlib-utilities.js'

export const object = {
  type: makeObjectNode({}),

  lookup: preludeFunctionArity2(
    ['object', 'lookup'],
    {
      // TODO
      parameter: types.atom,
      return: makeFunctionType('', {
        parameter: types.something,
        return: types.something,
      }),
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

  from_property: preludeFunctionArity2(
    ['object', 'from_property'],
    {
      // TODO
      parameter: types.atom,
      return: makeFunctionType('', {
        parameter: types.something,
        return: types.something,
      }),
    },
    key => {
      if (typeof key !== 'string') {
        return either.makeLeft({
          kind: 'panic',
          message: 'key was not an atom',
        })
      } else {
        return either.makeRight(value =>
          either.makeRight(makeObjectNode({ [key]: value })),
        )
      }
    },
  ),

  overlay: preludeFunctionArity2(
    ['object', 'overlay'],
    {
      // TODO
      parameter: types.object,
      return: makeFunctionType('', {
        parameter: types.object,
        return: types.something,
      }),
    },
    object2 => {
      if (typeof object2 !== 'object') {
        return either.makeLeft({
          kind: 'panic',
          message: 'argument was not an object',
        })
      } else {
        return either.makeRight(object1 => {
          if (!isObjectNode(object1)) {
            return either.makeLeft({
              kind: 'panic',
              message: 'argument was not an object',
            })
          } else {
            return either.makeRight({ ...object1, ...object2 })
          }
        })
      }
    },
  ),
} as const
