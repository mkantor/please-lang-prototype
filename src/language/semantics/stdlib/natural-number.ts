import either from '@matt.kantor/either'
import option from '@matt.kantor/option'
import { makeFunctionNode } from '../function-node.js'
import { types } from '../type-system.js'
import { makeFunctionType, makeUnionType } from '../type-system/type-formats.js'
import {
  preludeFunction,
  serializeOnceAppliedFunction,
} from './stdlib-utilities.js'

export const natural_number = {
  add: preludeFunction(
    ['natural_number', 'add'],
    {
      parameter: types.naturalNumber,
      return: makeFunctionType('', {
        parameter: types.naturalNumber,
        return: types.naturalNumber,
      }),
    },
    number2 =>
      either.makeRight(
        makeFunctionNode(
          {
            parameter: types.naturalNumber,
            return: types.naturalNumber,
          },
          serializeOnceAppliedFunction(['natural_number', 'add'], number2),
          option.none,
          number1 => {
            if (
              typeof number1 !== 'string' ||
              !types.naturalNumber.isAssignableFrom(
                makeUnionType('', [number1]),
              ) ||
              typeof number2 !== 'string' ||
              !types.naturalNumber.isAssignableFrom(
                makeUnionType('', [number2]),
              )
            ) {
              return either.makeLeft({
                kind: 'panic',
                message: 'numbers must be atoms',
              })
            } else {
              return either.makeRight(
                // FIXME: It's wasteful to always convert here.
                //
                // Consider `add(add(1)(1))(1)`—the `2` returned from the inner `add` is
                // stringified only to be converted back to a bigint. This is acceptable for the
                // prototype, but a real implementation could use a fancier `SemanticGraph` which
                // can model atoms as different native data types.
                String(BigInt(number1) + BigInt(number2)),
              )
            }
          },
        ),
      ),
  ),
  is: preludeFunction(
    ['natural_number', 'is'],
    {
      parameter: types.something,
      return: types.boolean,
    },
    argument =>
      either.makeRight(
        typeof argument === 'string' &&
          types.naturalNumber.isAssignableFrom({
            name: '',
            kind: 'union',
            members: new Set([argument]),
          })
          ? 'true'
          : 'false',
      ),
  ),
}
