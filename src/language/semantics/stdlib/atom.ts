import either from '@matt.kantor/either'
import { types } from '../type-system.js'
import { makeFunctionType } from '../type-system/type-formats.js'
import { preludeFunctionArity2 } from './stdlib-utilities.js'

export const atom = {
  type: types.atom.symbol,

  append: preludeFunctionArity2(
    ['atom', 'append'],
    {
      parameter: types.atom,
      return: makeFunctionType('', {
        parameter: types.atom,
        return: types.atom,
      }),
    },
    atomToAppend => {
      if (typeof atomToAppend !== 'string') {
        return either.makeLeft({
          kind: 'panic',
          message: '`append` expected an atom',
        })
      } else {
        return either.makeRight(atomToAppendTo => {
          if (typeof atomToAppendTo !== 'string') {
            return either.makeLeft({
              kind: 'panic',
              message: '`append` expected an atom',
            })
          } else {
            return either.makeRight(atomToAppendTo + atomToAppend)
          }
        })
      }
    },
  ),

  // Note that this is simple string equality; e.g. `:atom.equal(1)(01)`
  // is `false`. For this reason it should not be aliased as a global `==`
  // operator or similar as its behavior may not be what users expect for all
  // types of values.
  equal: preludeFunctionArity2(
    ['atom', 'equal'],
    {
      parameter: types.atom,
      return: makeFunctionType('', {
        parameter: types.atom,
        return: types.boolean,
      }),
    },
    atom2 => {
      if (typeof atom2 !== 'string') {
        return either.makeLeft({
          kind: 'panic',
          message: '`equal` expected an atom',
        })
      } else {
        return either.makeRight(atom1 => {
          if (typeof atom1 !== 'string') {
            return either.makeLeft({
              kind: 'panic',
              message: '`equal` expected an atom',
            })
          } else {
            return either.makeRight(String(atom1 === atom2))
          }
        })
      }
    },
  ),

  prepend: preludeFunctionArity2(
    ['atom', 'prepend'],
    {
      parameter: types.atom,
      return: makeFunctionType('', {
        parameter: types.atom,
        return: types.atom,
      }),
    },
    atomToPrepend => {
      if (typeof atomToPrepend !== 'string') {
        return either.makeLeft({
          kind: 'panic',
          message: '`prepend` expected an atom',
        })
      } else {
        return either.makeRight(atomToPrependTo => {
          if (typeof atomToPrependTo !== 'string') {
            return either.makeLeft({
              kind: 'panic',
              message: '`prepend` expected an atom',
            })
          } else {
            return either.makeRight(atomToPrepend + atomToPrependTo)
          }
        })
      }
    },
  ),
} as const
