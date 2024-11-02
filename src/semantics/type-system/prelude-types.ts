import {
  makeLazyType,
  makeObjectType,
  makeUnionType,
  matchTypeFormat,
} from './type-formats.js'

// the bottom type
export const nothing = makeUnionType('nothing', [])

// `null` unfortunately can't be a variable name
export const nullType = makeUnionType('null', ['null'])

export const boolean = makeUnionType('boolean', ['false', 'true'])

export const string = makeLazyType('string', {
  isAssignableFrom: source =>
    matchTypeFormat(source, {
      // `string` (currently) has no lazy subtypes (its only subtype is itself)
      lazy: (source): boolean => source === string,
      // `string` can't have object types assigned to it
      object: _source => false,
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
      // `string` (currently) has no lazy supertypes (its only supertype is itself)
      lazy: (target): boolean => target === string,
      // `string` can't be assigned to object types
      object: _target => false,
      // `string` can only be assigned to a union type if `string` is one of its members
      union: (target): boolean => target.members.has(string),
    }),
})

export const object = makeObjectType('object', {})

// the top type
export const value = makeUnionType('value', [string, object])
