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
  type: types.naturalNumber.symbol,
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
  modulo: preludeFunction(
    ['natural_number', 'modulo'],
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
          serializeOnceAppliedFunction(['natural_number', 'modulo'], number2),
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
              return either.makeRight(String(BigInt(number1) % BigInt(number2)))
            }
          },
        ),
      ),
  ),
} as const
