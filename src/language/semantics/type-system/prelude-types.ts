import optionAdt from '@matt.kantor/option'
import {
  makeFunctionType,
  makeObjectType,
  makeOpaqueType,
  makeUnionType,
  type FunctionType,
  type Type,
  type UnionType,
} from './type-formats.js'

export const nothing = makeUnionType('nothing', []) // the bottom type

// `null` unfortunately can't be a variable name
export const nullType = makeUnionType('null', ['null'])

export const boolean = makeUnionType('boolean', ['false', 'true'])

// The current type hierarchy for opaque types is:
//  - atom
//    - integer
//      - natural_number

export const atomTypeSymbol = Symbol('atom')
export const atom = makeOpaqueType('atom', atomTypeSymbol, {
  isAssignableFromLiteralType: (_literalType: string) => true,
  nearestOpaqueAssignableFrom: () => optionAdt.makeSome(integer),
  nearestOpaqueAssignableTo: () => optionAdt.none,
})

export const integerTypeSymbol = Symbol('integer')
export const integer = makeOpaqueType('integer', integerTypeSymbol, {
  isAssignableFromLiteralType: literalType =>
    /^(?:0|-?[1-9](?:[0-9])*)+$/.test(literalType),
  nearestOpaqueAssignableFrom: () => optionAdt.makeSome(naturalNumber),
  nearestOpaqueAssignableTo: () => optionAdt.makeSome(atom),
})

export const naturalNumberTypeSymbol = Symbol('natural_number')
export const naturalNumber = makeOpaqueType(
  'natural_number',
  naturalNumberTypeSymbol,
  {
    isAssignableFromLiteralType: literalType =>
      /^(?:0|[1-9](?:[0-9])*)+$/.test(literalType),
    nearestOpaqueAssignableFrom: () => optionAdt.none,
    nearestOpaqueAssignableTo: () => optionAdt.makeSome(integer),
  },
)

export const opaqueTypesBySymbol = {
  [atom.symbol]: atom,
  [integer.symbol]: integer,
  [naturalNumber.symbol]: naturalNumber,
}

export const object = makeObjectType('object', {})

// `functionType` and `something` reference each other directly, so we need to
// do a dance:
export const functionType: FunctionType = {} as FunctionType
export const something: UnionType = {} as UnionType // the top type
Object.assign(
  functionType,
  makeFunctionType('function', {
    parameter: nothing,
    return: something,
  }) satisfies FunctionType,
)
Object.assign(
  something,
  makeUnionType('something', [functionType, atom, object]) satisfies UnionType,
)

export const option = (value: Type) =>
  makeUnionType('option', [
    makeObjectType('some', {
      tag: makeUnionType('', ['some']),
      value,
    }),
    makeObjectType('none', {
      tag: makeUnionType('', ['none']),
      value: makeObjectType('', {}),
    }),
  ])

export const runtimeContext = makeObjectType('runtime_context', {
  arguments: makeObjectType('', {
    lookup: makeFunctionType('', { parameter: atom, return: option(atom) }),
  }),
  environment: makeObjectType('', {
    lookup: makeFunctionType('', { parameter: atom, return: option(atom) }),
  }),
  log: makeFunctionType('', { parameter: something, return: object }),
  program: makeObjectType('', { start_time: atom }),
})
