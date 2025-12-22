import either from '@matt.kantor/either'
import option from '@matt.kantor/option'
import { makeFunctionNode } from '../function-node.js'
import { types } from '../type-system.js'
import { makeFunctionType } from '../type-system/type-formats.js'
import {
  preludeFunction,
  serializeOnceAppliedFunction,
} from './stdlib-utilities.js'

export const atom = {
  append: preludeFunction(
    ['atom', 'append'],
    {
      parameter: types.atom,
      return: makeFunctionType('', {
        parameter: types.atom,
        return: types.atom,
      }),
    },
    atomToAppend =>
      either.makeRight(
        makeFunctionNode(
          {
            parameter: types.atom,
            return: types.atom,
          },
          serializeOnceAppliedFunction(['atom', 'append'], atomToAppend),
          option.none,
          atomToAppendTo => {
            if (
              typeof atomToAppend !== 'string' ||
              typeof atomToAppendTo !== 'string'
            ) {
              return either.makeLeft({
                kind: 'panic',
                message: 'append received a non-atom argument',
              })
            } else {
              return either.makeRight(atomToAppendTo + atomToAppend)
            }
          },
        ),
      ),
  ),
  // Note that this is simple string equality; e.g. `:atom.equal(1)(01)`
  // is `false`. For this reason it should not be aliased as a global `==`
  // operator or similar as its behavior may not be what users expect for all
  // types of values.
  equal: preludeFunction(
    ['atom', 'equal'],
    {
      parameter: types.atom,
      return: makeFunctionType('', {
        parameter: types.atom,
        return: types.boolean,
      }),
    },
    atom2 =>
      either.makeRight(
        makeFunctionNode(
          {
            parameter: types.atom,
            return: types.atom,
          },
          serializeOnceAppliedFunction(['atom', 'equal'], atom2),
          option.none,
          atom1 => {
            if (typeof atom2 !== 'string' || typeof atom1 !== 'string') {
              return either.makeLeft({
                kind: 'panic',
                message: 'equal received a non-atom argument',
              })
            } else {
              return either.makeRight(String(atom1 === atom2))
            }
          },
        ),
      ),
  ),
  prepend: preludeFunction(
    ['atom', 'prepend'],
    {
      parameter: types.atom,
      return: makeFunctionType('', {
        parameter: types.atom,
        return: types.atom,
      }),
    },
    atomToPrepend =>
      either.makeRight(
        makeFunctionNode(
          {
            parameter: types.atom,
            return: types.atom,
          },
          serializeOnceAppliedFunction(['atom', 'prepend'], atomToPrepend),
          option.none,
          atomToPrependTo =>
            typeof atomToPrepend !== 'string' ||
            typeof atomToPrependTo !== 'string'
              ? either.makeLeft({
                  kind: 'panic',
                  message: 'prepend received a non-atom argument',
                })
              : either.makeRight(atomToPrepend + atomToPrependTo),
        ),
      ),
  ),
}
