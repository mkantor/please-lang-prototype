import {
  makeFunctionType,
  makeObjectType,
  makeOpaqueType,
  makeUnionType,
  matchTypeFormat,
  type Type,
} from './type-formats.js'

// the bottom type
export const nothing = makeUnionType('nothing', [])

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
      // `string` (currently) has no opaque subtypes (its only subtype is itself)
      opaque: (source): boolean => source === string,
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
      opaque: (target): boolean => target === string,
      // `string` can only be assigned to a union type if `string` is one of its members
      union: (target): boolean => target.members.has(string),
    }),
})

export const object = makeObjectType('object', {})

// the top type
export const value = makeUnionType('value', [string, object])

// `function` unfortunately can't be a variable name
export const functionType = makeFunctionType('function', {
  parameter: nothing,
  return: value,
})

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
})
