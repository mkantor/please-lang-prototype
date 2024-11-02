import { makeUnionType, matchTypeFormat, type Type } from './type-formats.js'

export const isAssignable = ({
  source,
  target,
}: {
  readonly source: Type
  readonly target: Type
}): boolean =>
  matchTypeFormat(source, {
    lazy: source => source.isAssignableTo(target),
    object: source =>
      matchTypeFormat(target, {
        lazy: target => target.isAssignableFrom(source),
        object: target => {
          // Make sure all properties in the target are present and valid in the source
          // (recursively). Values may have additional properties beyond what is required by the
          // target and still be assignable to it.
          for (const [key, typePropertyValue] of Object.entries(
            target.children,
          )) {
            if (source.children[key] === undefined) {
              return false
            } else {
              // Recursively check the property:
              if (
                !isAssignable({
                  source: source.children[key],
                  target: typePropertyValue,
                })
              ) {
                return false
              }
            }
          }
          return true
        },
        union: target => {
          for (const type of target.members) {
            if (
              typeof type !== 'string' &&
              isAssignable({ target: type, source })
            ) {
              return true
            }
          }
          return false
        },
      }),
    union: source =>
      matchTypeFormat(target, {
        lazy: target => target.isAssignableFrom(source),
        object: target => {
          // Return true if every member of the source is assignable to the target.
          for (const sourceMember of source.members) {
            // Atoms cannot be subtypes of objects.
            if (typeof sourceMember === 'string') {
              return false
            }
            if (!isAssignable({ target, source: sourceMember })) {
              return false
            }
          }
          return true
        },
        union: target => {
          // Return true if every member of the source is assignable to some member of the target.
          for (const sourceMember of source.members) {
            const sourceMemberIsAssignableToSomeMemberOfSupertype = (() => {
              for (const superTypeMember of target.members) {
                if (sourceMember === superTypeMember) {
                  return true
                } else if (typeof superTypeMember !== 'string') {
                  if (
                    isAssignable({
                      target: superTypeMember,
                      source:
                        typeof sourceMember !== 'string'
                          ? sourceMember
                          : makeUnionType(sourceMember, [sourceMember]),
                    })
                  ) {
                    return true
                  }
                }
              }
              return false
            })()

            if (!sourceMemberIsAssignableToSomeMemberOfSupertype) {
              return false
            }
          }
          return true
        },
      }),
  })
