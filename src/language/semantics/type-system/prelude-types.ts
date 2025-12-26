import optionAdt from '@matt.kantor/option'
import {
  makeFunctionType,
  makeObjectType,
  makeOpaqueAtomType,
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

export const atom = makeOpaqueAtomType('atom', {
  isAssignableFromLiteralType: (_literalType: string) => true,
  nearestOpaqueAssignableFrom: () => optionAdt.makeSome(integer),
  nearestOpaqueAssignableTo: () => optionAdt.none,
})

export const integer = makeOpaqueAtomType('integer', {
  isAssignableFromLiteralType: literalType =>
    /^(?:0|-?[1-9](?:[0-9])*)+$/.test(literalType),
  nearestOpaqueAssignableFrom: () => optionAdt.makeSome(naturalNumber),
  nearestOpaqueAssignableTo: () => optionAdt.makeSome(atom),
})

export const naturalNumber = makeOpaqueAtomType('natural_number', {
  isAssignableFromLiteralType: literalType =>
    /^(?:0|[1-9](?:[0-9])*)+$/.test(literalType),
  nearestOpaqueAssignableFrom: () => optionAdt.none,
  nearestOpaqueAssignableTo: () => optionAdt.makeSome(integer),
})

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
  environment: makeObjectType('', {
    lookup: makeFunctionType('', { parameter: atom, return: option(atom) }),
  }),
  log: makeFunctionType('', { parameter: something, return: option(object) }),
  program: makeObjectType('', { start_time: atom }),
})
