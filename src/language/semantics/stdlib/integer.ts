import either from '@matt.kantor/either'
import option from '@matt.kantor/option'
import { makeFunctionNode } from '../function-node.js'
import { types } from '../type-system.js'
import { makeFunctionType, makeUnionType } from '../type-system/type-formats.js'
import {
  preludeFunction,
  serializeOnceAppliedFunction,
} from './stdlib-utilities.js'

export const integer = {
  add: preludeFunction(
    ['integer', 'add'],
    {
      parameter: types.integer,
      return: makeFunctionType('', {
        parameter: types.integer,
        return: types.integer,
      }),
    },
    number2 =>
      either.makeRight(
        makeFunctionNode(
          {
            parameter: types.integer,
            return: types.integer,
          },
          serializeOnceAppliedFunction(['integer', 'add'], number2),
          option.none,
          number1 => {
            if (
              typeof number1 !== 'string' ||
              !types.integer.isAssignableFrom(makeUnionType('', [number1])) ||
              typeof number2 !== 'string' ||
              !types.integer.isAssignableFrom(makeUnionType('', [number2]))
            ) {
              return either.makeLeft({
                kind: 'panic',
                message: 'numbers must be atoms',
              })
            } else {
              return either.makeRight(
                // TODO: See comment in `natural_number.add`.
                String(BigInt(number1) + BigInt(number2)),
              )
            }
          },
        ),
      ),
  ),
  is: preludeFunction(
    ['integer', 'is'],
    {
      parameter: types.something,
      return: types.boolean,
    },
    argument =>
      either.makeRight(
        typeof argument === 'string' &&
          types.integer.isAssignableFrom({
            name: '',
            kind: 'union',
            members: new Set([argument]),
          })
          ? 'true'
          : 'false',
      ),
  ),
  less_than: preludeFunction(
    ['integer', 'less_than'],
    {
      parameter: types.integer,
      return: makeFunctionType('', {
        parameter: types.integer,
        return: types.integer,
      }),
    },
    number2 =>
      either.makeRight(
        makeFunctionNode(
          {
            parameter: types.integer,
            return: types.boolean,
          },
          serializeOnceAppliedFunction(['integer', 'less_than'], number2),
          option.none,
          number1 => {
            if (
              typeof number1 !== 'string' ||
              !types.integer.isAssignableFrom(makeUnionType('', [number1])) ||
              typeof number2 !== 'string' ||
              !types.integer.isAssignableFrom(makeUnionType('', [number2]))
            ) {
              return either.makeLeft({
                kind: 'panic',
                message: 'numbers must be atoms',
              })
            } else {
              return either.makeRight(
                // TODO: See comment in `natural_number.add`.
                String(BigInt(number1) < BigInt(number2)),
              )
            }
          },
        ),
      ),
  ),
  subtract: preludeFunction(
    ['integer', 'subtract'],
    {
      parameter: types.integer,
      return: makeFunctionType('', {
        parameter: types.integer,
        return: types.integer,
      }),
    },
    number2 =>
      either.makeRight(
        makeFunctionNode(
          {
            parameter: types.integer,
            return: types.integer,
          },
          serializeOnceAppliedFunction(['integer', 'subtract'], number2),
          option.none,
          number1 => {
            if (
              typeof number1 !== 'string' ||
              !types.integer.isAssignableFrom(makeUnionType('', [number1])) ||
              typeof number2 !== 'string' ||
              !types.integer.isAssignableFrom(makeUnionType('', [number2]))
            ) {
              return either.makeLeft({
                kind: 'panic',
                message: 'numbers must be atoms',
              })
            } else {
              return either.makeRight(
                // TODO: See comment in `natural_number.add`.
                String(BigInt(number1) - BigInt(number2)),
              )
            }
          },
        ),
      ),
  ),
}
