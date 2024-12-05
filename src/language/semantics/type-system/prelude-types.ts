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
      // `string` (currently) has no opaque subtypes (its only subtype is itself)
      opaque: source => source === string,
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
      union: target => target.members.has(string), // FIXME this and other checks will only work if i make sure all references to `string` use exactly this instance! otherwise i need to use TypeIDs
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
