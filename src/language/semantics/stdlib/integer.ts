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
  type: types.integer.symbol,
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
                // FIXME: It's wasteful to always convert here.
                //
                // Consider `add(add(1)(1))(1)`—the `2` returned from the inner
                // `add` is stringified only to be converted back to a bigint.
                // This is acceptable for the prototype, but a real
                // implementation could use a fancier `SemanticGraph` which can
                // model atoms as different native data types.
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
  greater_than: preludeFunction(
    ['integer', 'greater_than'],
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
          serializeOnceAppliedFunction(['integer', 'greater_than'], number2),
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
                // TODO: See comment in `integer.add`.
                String(BigInt(number1) > BigInt(number2)),
              )
            }
          },
        ),
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
                // TODO: See comment in `integer.add`.
                String(BigInt(number1) < BigInt(number2)),
              )
            }
          },
        ),
      ),
  ),
  multiply: preludeFunction(
    ['integer', 'multiply'],
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
          serializeOnceAppliedFunction(['integer', 'multiply'], number2),
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
                // TODO: See comment in `integer.add`.
                String(BigInt(number1) * BigInt(number2)),
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
                // TODO: See comment in `integer.add`.
                String(BigInt(number1) - BigInt(number2)),
              )
            }
          },
        ),
      ),
  ),
}
