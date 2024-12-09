import { option as optionADT } from '../../../adts.js'
import {
  makeFunctionType,
  makeObjectType,
  makeOpaqueStringType,
  makeUnionType,
  type FunctionType,
  type Type,
  type UnionType,
} from './type-formats.js'

export const nothing = makeUnionType('nothing', []) // the bottom type

// `null` unfortunately can't be a variable name
export const nullType = makeUnionType('null', ['null'])

export const boolean = makeUnionType('boolean', ['false', 'true'])

export const string = makeOpaqueStringType('string', {
  isAssignableFromLiteralType: (_literalType: string) => true,
  nearestOpaqueAssignableFrom: () => optionADT.makeSome(naturalNumber),
  nearestOpaqueAssignableTo: () => optionADT.none,
})

export const naturalNumber = makeOpaqueStringType('natural_number', {
  isAssignableFromLiteralType: literalType =>
    /(?:0|[1-9](?:[0-9])*)+/.test(literalType),
  nearestOpaqueAssignableFrom: () => optionADT.none,
  nearestOpaqueAssignableTo: () => optionADT.makeSome(string),
})

export const object = makeObjectType('object', {})

// `functionType` and `something` reference each other directly, so we need to do a dance:
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
  makeUnionType('something', [
    functionType,
    string,
    object,
  ]) satisfies UnionType,
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
    lookup: makeFunctionType('', { parameter: string, return: option(string) }),
  }),
  log: makeFunctionType('', { parameter: something, return: option(object) }),
  program: makeObjectType('', { start_time: string }),
})
