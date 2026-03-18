import either from '@matt.kantor/either'
import { types } from '../type-system.js'
import { makeFunctionType, makeUnionType } from '../type-system/type-formats.js'
import {
  preludeFunctionArity1,
  preludeFunctionArity2,
} from './stdlib-utilities.js'

export const integer = {
  type: types.integer.symbol,
  add: preludeFunctionArity2(
    ['integer', 'add'],
    {
      parameter: types.integer,
      return: makeFunctionType('', {
        parameter: types.integer,
        return: types.integer,
      }),
    },
    {
      parameter: types.integer,
      return: types.integer,
    },
    number2 => {
      if (
        typeof number2 !== 'string' ||
        !types.integer.isAssignableFrom(makeUnionType('', [number2]))
      ) {
        return either.makeLeft({
          kind: 'panic',
          message: 'numbers must be atoms',
        })
      } else {
        return either.makeRight(number1 => {
          if (
            typeof number1 !== 'string' ||
            !types.integer.isAssignableFrom(makeUnionType('', [number1]))
          ) {
            return either.makeLeft({
              kind: 'panic',
              message: 'numbers must be atoms',
            })
          } else {
            // FIXME: It's wasteful to always convert here.
            //
            // Consider `add(add(1)(1))(1)`—the `2` returned from the inner
            // `add` is stringified only to be converted back to a bigint.
            // This is acceptable for the prototype, but a real
            // implementation could use a fancier `SemanticGraph` which can
            // model atoms as different native data types.
            return either.makeRight(String(BigInt(number1) + BigInt(number2)))
          }
        })
      }
    },
  ),
  equals: preludeFunctionArity2(
    ['integer', 'equals'],
    {
      parameter: types.integer,
      return: makeFunctionType('', {
        parameter: types.integer,
        return: types.boolean,
      }),
    },
    {
      parameter: types.integer,
      return: types.boolean,
    },
    number2 => {
      if (
        typeof number2 !== 'string' ||
        !types.integer.isAssignableFrom(makeUnionType('', [number2]))
      ) {
        return either.makeLeft({
          kind: 'panic',
          message: 'argument was not an integer',
        })
      } else {
        return either.makeRight(number1 => {
          if (
            typeof number1 !== 'string' ||
            !types.integer.isAssignableFrom(makeUnionType('', [number1]))
          ) {
            return either.makeLeft({
              kind: 'panic',
              message: 'argument was not an integer',
            })
          } else {
            // TODO: See comment in `integer.add`.
            return either.makeRight(String(BigInt(number1) === BigInt(number2)))
          }
        })
      }
    },
  ),
  is: preludeFunctionArity1(
    ['integer', 'is'],
    {
      parameter: types.something,
      return: types.boolean,
    },
    argument =>
      either.makeRight(
        (
          typeof argument === 'string' &&
            types.integer.isAssignableFrom({
              name: '',
              kind: 'union',
              members: new Set([argument]),
            })
        ) ?
          'true'
        : 'false',
      ),
  ),
  greater_than: preludeFunctionArity2(
    ['integer', 'greater_than'],
    {
      parameter: types.integer,
      return: makeFunctionType('', {
        parameter: types.integer,
        return: types.boolean,
      }),
    },
    {
      parameter: types.integer,
      return: types.boolean,
    },
    number2 => {
      if (
        typeof number2 !== 'string' ||
        !types.integer.isAssignableFrom(makeUnionType('', [number2]))
      ) {
        return either.makeLeft({
          kind: 'panic',
          message: 'numbers must be atoms',
        })
      } else {
        return either.makeRight(number1 => {
          if (
            typeof number1 !== 'string' ||
            !types.integer.isAssignableFrom(makeUnionType('', [number1]))
          ) {
            return either.makeLeft({
              kind: 'panic',
              message: 'numbers must be atoms',
            })
          } else {
            // TODO: See comment in `integer.add`.
            return either.makeRight(String(BigInt(number1) > BigInt(number2)))
          }
        })
      }
    },
  ),
  less_than: preludeFunctionArity2(
    ['integer', 'less_than'],
    {
      parameter: types.integer,
      return: makeFunctionType('', {
        parameter: types.integer,
        return: types.boolean,
      }),
    },
    {
      parameter: types.integer,
      return: types.boolean,
    },
    number2 => {
      if (
        typeof number2 !== 'string' ||
        !types.integer.isAssignableFrom(makeUnionType('', [number2]))
      ) {
        return either.makeLeft({
          kind: 'panic',
          message: 'numbers must be atoms',
        })
      } else {
        return either.makeRight(number1 => {
          if (
            typeof number1 !== 'string' ||
            !types.integer.isAssignableFrom(makeUnionType('', [number1]))
          ) {
            return either.makeLeft({
              kind: 'panic',
              message: 'numbers must be atoms',
            })
          } else {
            // TODO: See comment in `integer.add`.
            return either.makeRight(String(BigInt(number1) < BigInt(number2)))
          }
        })
      }
    },
  ),
  multiply: preludeFunctionArity2(
    ['integer', 'multiply'],
    {
      parameter: types.integer,
      return: makeFunctionType('', {
        parameter: types.integer,
        return: types.integer,
      }),
    },
    {
      parameter: types.integer,
      return: types.integer,
    },
    number2 => {
      if (
        typeof number2 !== 'string' ||
        !types.integer.isAssignableFrom(makeUnionType('', [number2]))
      ) {
        return either.makeLeft({
          kind: 'panic',
          message: 'numbers must be atoms',
        })
      } else {
        return either.makeRight(number1 => {
          if (
            typeof number1 !== 'string' ||
            !types.integer.isAssignableFrom(makeUnionType('', [number1]))
          ) {
            return either.makeLeft({
              kind: 'panic',
              message: 'numbers must be atoms',
            })
          } else {
            // TODO: See comment in `integer.add`.
            return either.makeRight(String(BigInt(number1) * BigInt(number2)))
          }
        })
      }
    },
  ),
  subtract: preludeFunctionArity2(
    ['integer', 'subtract'],
    {
      parameter: types.integer,
      return: makeFunctionType('', {
        parameter: types.integer,
        return: types.integer,
      }),
    },
    {
      parameter: types.integer,
      return: types.integer,
    },
    number2 => {
      if (
        typeof number2 !== 'string' ||
        !types.integer.isAssignableFrom(makeUnionType('', [number2]))
      ) {
        return either.makeLeft({
          kind: 'panic',
          message: 'numbers must be atoms',
        })
      } else {
        return either.makeRight(number1 => {
          if (
            typeof number1 !== 'string' ||
            !types.integer.isAssignableFrom(makeUnionType('', [number1]))
          ) {
            return either.makeLeft({
              kind: 'panic',
              message: 'numbers must be atoms',
            })
          } else {
            // TODO: See comment in `integer.add`.
            return either.makeRight(String(BigInt(number1) - BigInt(number2)))
          }
        })
      }
    },
  ),
} as const
