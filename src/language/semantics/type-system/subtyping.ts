import type { Atom } from '../../parsing.js'
import {
  makeObjectType,
  makeUnionType,
  matchTypeFormat,
  type ObjectType,
  type Type,
  type UnionType,
} from './type-formats.js'
import {
  containedTypeParameters,
  findKeyPathsToTypeParameter,
  supplyTypeArgument,
  updateTypeAtKeyPathIfValid,
} from './type-utilities.js'

export const isAssignable = ({
  source: rawSource,
  target: rawTarget,
}: {
  readonly source: Type | Atom
  readonly target: Type | Atom
}): boolean => {
  const source =
    typeof rawSource === 'string' ? makeUnionType('', [rawSource]) : rawSource
  const target =
    typeof rawTarget === 'string' ? makeUnionType('', [rawTarget]) : rawTarget

  return (
    source === target || // in this case there's no reason to spend time checking structural assignability
    matchTypeFormat(source, {
      function: source =>
        matchTypeFormat(target, {
          function: target => {
            // Functions are contravariant in parameters, covariant in return types.
            if (
              source.signature.parameter.kind === 'parameter' &&
              source.signature.return.kind === 'parameter' &&
              source.signature.parameter.identity ===
                source.signature.return.identity
            ) {
              // The source is an identity function (`a => a`), which means this much simpler check
              // can be performed. This also allows correctly handling the fact that `a => a` is
              // assignable to a type like `atom => atom`.
              return (
                isAssignable({
                  source: target.signature.parameter,
                  target: target.signature.return,
                }) &&
                isAssignable({
                  source: target.signature.parameter,
                  target: source.signature.parameter.constraint.assignableTo,
                })
              )
            } else {
              const sourceParameterTypeParameters = containedTypeParameters(
                source.signature.parameter,
              )
              const targetParameterTypeParameters = containedTypeParameters(
                target.signature.parameter,
              )

              // An example showing how this will be used:
              // When checking whether `{ a: (a <: atom) } => a` is assignable to
              // `{ a: (b <: "a") } => b`, the parameter types are compatible if
              // `{ a: (b <: "a") }` is assignable to `{ a: atom }` (it is).
              let sourceParameterWithTypeParametersReplacedByConstraints =
                source.signature.parameter

              // An example showing how this will be used:
              // When checking whether `a => { a: a, b: atom }` is assignable to
              // `(b <: atom) => { a: b }`, the return types are compatible if
              // `{ a: b, b: atom }` is assignable to `{ a: b }` (it is).
              let sourceReturnWithTypeParametersReplacedByTargetTypeParameters =
                source.signature.return

              for (const [
                stringifiedKeyPath,
                sourceTypeParametersAtThisKeyPath,
              ] of sourceParameterTypeParameters) {
                for (const sourceTypeParameter of sourceTypeParametersAtThisKeyPath
                  .typeParameters.members) {
                  sourceParameterWithTypeParametersReplacedByConstraints =
                    supplyTypeArgument(
                      sourceParameterWithTypeParametersReplacedByConstraints,
                      sourceTypeParameter,
                      sourceTypeParameter.constraint.assignableTo,
                    )

                  const correspondingTargetTypeParameter =
                    targetParameterTypeParameters.get(stringifiedKeyPath)

                  if (correspondingTargetTypeParameter !== undefined) {
                    const locationsOfSourceTypeParameterInSourceReturn =
                      findKeyPathsToTypeParameter(
                        source.signature.return,
                        sourceTypeParameter,
                      )

                    for (const locationOfSourceTypeParameterInSourceReturn of locationsOfSourceTypeParameterInSourceReturn) {
                      sourceReturnWithTypeParametersReplacedByTargetTypeParameters =
                        updateTypeAtKeyPathIfValid(
                          sourceReturnWithTypeParametersReplacedByTargetTypeParameters,
                          locationOfSourceTypeParameterInSourceReturn,
                          typeAtKeyPath => {
                            if (
                              typeAtKeyPath.kind === 'parameter' &&
                              typeAtKeyPath.identity ===
                                sourceTypeParameter.identity
                            ) {
                              return correspondingTargetTypeParameter.typeParameters
                            } else {
                              return typeAtKeyPath
                            }
                          },
                        )
                    }
                  }
                }
              }

              return (
                // Contravariant parameter check:
                isAssignable({
                  source: target.signature.parameter,
                  target:
                    sourceParameterWithTypeParametersReplacedByConstraints,
                }) &&
                // Covariant return type check:
                isAssignable({
                  source:
                    sourceReturnWithTypeParametersReplacedByTargetTypeParameters,
                  target: target.signature.return,
                })
              )
            }
          },
          object: _target => false, // functions are never assignable to objects
          opaque: target => target.isAssignableFrom(source),
          parameter: _target => false, // a function type is never directly assignable to a type parameter
          union: target => isNonUnionAssignableToUnion({ source, target }),
        }),
      object: source =>
        matchTypeFormat(target, {
          function: _ => false, // objects are never assignable to functions
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
          opaque: target => target.isAssignableFrom(source),
          parameter: _target => false, // an object type is never directly assignable to a type parameter
          union: target => isNonUnionAssignableToUnion({ source, target }),
        }),
      opaque: source => source.isAssignableTo(target),
      parameter: source =>
        // A type parameter is only assignable to a type parameter if they are the same parameter.
        // For any other `target`, a type parameter is assignable to it if its constraint is.
        target.kind === 'parameter'
          ? source.identity === target.identity
          : isAssignable({
              source: source.constraint.assignableTo,
              target,
            }),
      union: source =>
        matchTypeFormat(target, {
          function: target => isUnionAssignableToNonUnion({ source, target }),
          object: target => isUnionAssignableToNonUnion({ source, target }),
          opaque: target => isUnionAssignableToNonUnion({ source, target }),
          parameter: target => isUnionAssignableToNonUnion({ source, target }),
          union: target => {
            // Return true if every member of the source is assignable to some member of the target.
            for (const sourceMember of source.members) {
              const sourceMemberIsAssignableToSomeMemberOfSupertype = (() => {
                const preparedTarget = simplifyUnionType(target)
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
  )
}

const isNonUnionAssignableToUnion = ({
  source,
  target,
}: {
  readonly source: Exclude<Type, UnionType>
  readonly target: UnionType
}): boolean => {
  if (source.kind === 'opaque') {
    return source.isAssignableTo(target)
  } else {
    // The strategy for this case is to check whether any of the target's members are assignable to
    // the source type. However this alone is not sufficient—for example `{ a: 'a' | 'b' }` should
    // be assignable to `{ a: 'a' } | { a: 'b' }` even though `{ a: 'a' | 'b' }` is not directly
    // assignable to `{ a: 'a' }` nor `{ a: 'b' }`. To make things work the target type is first
    // converted into a standard form (e.g. `{ a: 'a' } | { a: 'b' }` is translated into
    // `{ a: 'a' | 'b' }`.

    const preparedTarget = simplifyUnionType(target)

    for (const type of preparedTarget.members) {
      if (typeof type !== 'string' && isAssignable({ target: type, source })) {
        return true
      }
    }
    return false
  }
}

const isUnionAssignableToNonUnion = ({
  source,
  target,
}: {
  readonly source: UnionType
  readonly target: Exclude<Type, UnionType>
}): boolean => {
  if (target.kind === 'opaque') {
    return target.isAssignableFrom(source)
  } else {
    // Return true if every member of the source is assignable to the target.
    for (const sourceMember of source.members) {
      // Atoms cannot be subtypes of objects.
      if (typeof sourceMember === 'string') {
        return false
      }
      if (
        !isAssignable({
          target,
          source: sourceMember,
        })
      ) {
        return false
      }
    }
    return true
  }
}

/**
 * Removes redundancies and otherwise attempts to reduce the number of members in a union while
 * preserving the semantics of the given `UnionType`.
 *
 * For example, `{ a: 'a' | 'b' } | { a: 'b' } | { a: 'c' } | atom | 'a'` is simplified to
 * `{ a: 'a' | 'b' | 'c' } | atom`.
 */
export const simplifyUnionType = (typeToSimplify: UnionType): UnionType => {
  const reducibleSubsets: Map<
    string,
    {
      readonly keys: readonly string[]
      readonly typesToMerge: Set<ObjectType>
    }
  > = new Map()
  for (const type of typeToSimplify.members) {
    if (typeof type !== 'string' && type.kind === 'object') {
      const keys = Object.keys(type.children)

      // Object types with a single key are always mergeable with other object types containing the
      // same single key. For example `{ a: 'a' } | { a: 'b' }` can become `{ a: 'a' | 'b' }`.
      // TODO: Handle cases where there is more than one key but property types are compatible. For
      // example `{ a: 'a', b: 'b' } | { a: 'b', b: 'b' }` can become `{ a: 'a' | 'b', b: 'b' }`.
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

  const canonicalizedTargetMembers: Set<Atom | Exclude<Type, UnionType>> =
    new Set([...typeToSimplify.members])

  // Reduce `reducibleSubsets` by merging all candidate, updating `canonicalizedTargetMembers`.
  // Merge algorithm:
  //  - for each reducible subset of object types:
  //    - for each shared key within that subset:
  //      - get the key's property type from every member of `typesToMerge`
  //      - create a union allowing any of those types
  //    - create single object type where each property has the appropriate union type
  for (const { keys, typesToMerge } of reducibleSubsets.values()) {
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
        const propertyTypeAsUnion = excludeRedundantUnionTypeMembers(
          makeUnionType('', typesForThisProperty),
        )
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

  return excludeRedundantUnionTypeMembers({
    kind: 'union',
    name: typeToSimplify.name,
    members: canonicalizedTargetMembers,
  })
}

const excludeRedundantUnionTypeMembers = (type: UnionType) => {
  const membersAsArray = [...type.members]
  return makeUnionType(
    type.name,
    membersAsArray.filter(
      (possiblyRedundantMember, index) =>
        // If `possiblyRedundantMember` is assignable to any other member, filter it out
        !membersAsArray.some(
          (otherMember, otherIndex) =>
            index !== otherIndex &&
            isAssignable({
              source: possiblyRedundantMember,
              target: otherMember,
            }),
        ),
    ),
  )
}
