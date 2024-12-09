import {
  makeFunctionType,
  makeObjectType,
  makeOpaqueType,
  makeUnionType,
  matchTypeFormat,
  type FunctionType,
  type Type,
  type UnionType,
} from './type-formats.js'

export const nothing = makeUnionType('nothing', []) // the bottom type

// `null` unfortunately can't be a variable name
export const nullType = makeUnionType('null', ['null'])

export const boolean = makeUnionType('boolean', ['false', 'true'])

export const string = makeOpaqueType('string', {
  isAssignableFrom: source =>
    matchTypeFormat(source, {
      // functions cannot be assigned to `string`
      function: _ => false,
      // `string` can't have object types assigned to it
      object: _source => false,
      // the only opaque subtypes of `string` are `naturalNumber` and itself
      opaque: source => source === string || source === naturalNumber,
      parameter: source =>
        string.isAssignableFrom(source.constraint.assignableTo),
      // `string` can have a union assigned to it if all of its members can be assigned to it
      union: source => {
        for (const sourceMember of source.members) {
          if (
            typeof sourceMember !== 'string' &&
            !string.isAssignableFrom(sourceMember)
          ) {
            return false
          }
        }
        return true
      },
    }),
  isAssignableTo: target =>
    matchTypeFormat(target, {
      // `string` cannot be assigned to a function type
      function: _ => false,
      // `string` can't be assigned to object types
      object: _target => false,
      // `string` (currently) has no opaque supertypes (its only supertype is itself)
      opaque: target => target === string,
      parameter: target => target.constraint.assignableTo === string,
      // `string` can only be assigned to a union type if `string` is one of its members
      union: target => target.members.has(string),
    }),
})

export const naturalNumber = makeOpaqueType('natural_number', {
  isAssignableFrom: source =>
    matchTypeFormat(source, {
      function: _ => false,
      object: _source => false,
      // `naturalNumber` (currently) has no opaque subtypes (its only subtype is itself)
      opaque: source => source === naturalNumber,
      parameter: source =>
        naturalNumber.isAssignableFrom(source.constraint.assignableTo),
      // `naturalNumber` can have a union assigned to it if all of its members can be assigned to it
      union: source => {
        for (const sourceMember of source.members) {
          if (typeof sourceMember === 'string') {
            if (!/(?:0|[1-9](?:[0-9])*)+/.test(sourceMember)) {
              return false
            }
          } else if (!naturalNumber.isAssignableFrom(sourceMember)) {
            return false
          }
        }
        return true
      },
    }),
  isAssignableTo: target =>
    matchTypeFormat(target, {
      function: _ => false,
      object: _target => false,
      opaque: target => target === naturalNumber || target === string,
      parameter: target => target.constraint.assignableTo === naturalNumber,
      // `naturalNumber` can only be assigned to a union type if `naturalNumber` is one of its members
      union: target =>
        target.members.has(naturalNumber) || target.members.has(string),
    }),
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
