import type { Atom } from '../../parsing.js'
import {
  makeObjectType,
  makeUnionType,
  matchTypeFormat,
  type LazyType,
  type ObjectType,
  type Type,
  type UnionType,
} from './type-formats.js'

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
          // The strategy for this case is to check whether any of the target's members are
          // assignable to the source type. However this alone is not sufficient—for example
          // `{ a: 'a' | 'b' }` should be assignable to `{ a: 'a' } | { a: 'b' }` even though
          // `{ a: 'a' | 'b' }` is not directly assignable to `{ a: 'a' }` nor `{ a: 'b' }`. To
          // make things work the target type is first converted into a standard form (e.g.
          // `{ a: 'a' } | { a: 'b' }` is translated into `{ a: 'a' | 'b' }`.

          const preparedTarget =
            prepareTargetUnionTypeForObjectSourceAssignabilityCheck(target)

          for (const type of preparedTarget.members) {
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
              const preparedTarget =
                prepareTargetUnionTypeForObjectSourceAssignabilityCheck(target)
              for (const targetMember of preparedTarget.members) {
                if (sourceMember === targetMember) {
                  return true
                } else if (typeof targetMember !== 'string') {
                  if (
                    isAssignable({
                      target: targetMember,
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

// Note that this does not perform a full canonicalization of the given type. For example
// `{} | { a: string }` does not get reduced to `{}`. It may evolve in that direction, though (a
// more comprehensive reduction could improve type checking performance by eliminating cases, and
// it would be nice if `showType` always used a canonical form).
const prepareTargetUnionTypeForObjectSourceAssignabilityCheck = (
  target: UnionType,
): UnionType => {
  const reducibleSubsets: Map<
    string,
    {
      readonly keys: string[]
      readonly typesToMerge: Set<ObjectType>
    }
  > = new Map()
  for (const type of target.members) {
    if (typeof type !== 'string' && type.kind === 'object') {
      const keys = Object.keys(type.children)

      // Object types with a single key are always mergeable with other object types
      // containing the same single key. For example `{ a: 'a' } | { a: 'b' }` can become
      // `{ a: 'a' | 'b' }`.
      // TODO: Handle cases where there is more than one key but property types are
      // compatible. For example `{ a: 'a', b: 'b' } | { a: 'b', b: 'b' }` can become
      // `{ a: 'a' | 'b', b: 'b' }`.
      const fingerprint = keys[0]
      if (keys.length === 1 && fingerprint !== undefined) {
        const objectTypesWithThisFingerprint = reducibleSubsets.get(
          fingerprint,
        ) ?? { keys, typesToMerge: new Set() }
        reducibleSubsets.set(fingerprint, {
          keys,
          typesToMerge: objectTypesWithThisFingerprint.typesToMerge.add(type),
        })
      }
    }
  }

  const canonicalizedTargetMembers: Set<Atom | LazyType | ObjectType> = new Set(
    [...target.members],
  )
  // Reduce `reducibleSubsets` by merging all candidate, updating `canonicalizedTargetMembers`.
  // Merge algorithm:
  //  - for each reducible subset of object types:
  //    - for each shared key within that subset:
  //      - get the key's property type from every member of `typesToMerge`
  //      - create a union allowing any of those types
  //    - create single object type where each property has the appropriate union type
  for (const [fingerprint, { keys, typesToMerge }] of reducibleSubsets) {
    const typesToMergeAsArray = [...typesToMerge]
    const mergedObjectTypeChildren = Object.fromEntries(
      keys.map(key => {
        const typesForThisProperty = typesToMergeAsArray
          .flatMap(type => {
            const propertyType = type.children[key]
            return propertyType === undefined
              ? []
              : propertyType.kind === 'union'
              ? [...propertyType.members] // flatten any existing unions in property types
              : [propertyType]
          })
          .filter(type => type !== undefined)
        const propertyTypeAsUnion = makeUnionType('', typesForThisProperty)
        return [key, propertyTypeAsUnion] as const
      }),
    )
    const mergedObjectType = makeObjectType('', mergedObjectTypeChildren)

    // Remove all `typesToMerge` from `canonicalizedTargetMembers`.
    for (const typeWhichHasBeenMerged of typesToMerge) {
      canonicalizedTargetMembers.delete(typeWhichHasBeenMerged)
    }
    canonicalizedTargetMembers.add(mergedObjectType)
  }

  return makeUnionType(target.name, [...canonicalizedTargetMembers])
}
