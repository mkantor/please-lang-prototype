import either, { type Either } from '@matt.kantor/either'
import option, { type Option } from '@matt.kantor/option'
import type { Writable } from '../../../utility-types.js'
import type { Atom } from '../../parsing.js'
import type { FunctionNodeCallError } from '../function-node.js'
import { nothing, something } from './prelude-types.js'
import { asUnionWithLiteralAtomMembers, isAssignable } from './subtyping.js'
import {
  makeApplicationType,
  makeFunctionType,
  makeIntrinsicApplicationType,
  makeObjectType,
  makeTypeParameter,
  makeUnionType,
  matchTypeFormat,
  type FunctionType,
  type ObjectType,
  type Type,
  type TypeParameter,
} from './type-formats.js'
import {
  atomKeyPathComponentFromType,
  functionParameterKey,
  functionReturnKey,
  nestedIndexedAccess,
  typeParameterAssignableToConstraintKey,
  type TypeKeyPath,
} from './type-key-path.js'
import {
  containedTypeParameters,
  typeParameterIdentitiesWithinType,
} from './type-parameter-analysis.js'

/**
 * Drill into `type` using the given `keyPath`, returning the bottom type
 * (`nothing`) whenever no match is found. When drilling into union types, union
 * members for which the given `keyPath` isn't applicable are filtered out.
 */
export const applyKeyPathToType = (type: Type, keyPath: TypeKeyPath): Type => {
  const [firstKey, ...remainingKeyPath] = keyPath
  if (firstKey === undefined) {
    // If the key path is empty, this is the type we're looking for.
    return type
  } else if (typeof firstKey === 'object') {
    switch (firstKey.kind) {
      case 'parameter':
        return nestedIndexedAccess(type, [firstKey, ...remainingKeyPath])
      case 'union':
        return makeUnionType(
          // Flatten to avoid nested unions.
          [...firstKey.members].flatMap(firstKeyMember => {
            const typeForThisPossibility = applyKeyPathToType(type, [
              firstKeyMember,
              ...remainingKeyPath,
            ])
            if (typeForThisPossibility.kind === 'union') {
              return [...typeForThisPossibility.members]
            } else {
              return typeForThisPossibility
            }
          }),
        )
    }
  } else {
    return matchTypeFormat<Type>(type, {
      application: applicationType => {
        // Indexing into a stuck application stays stuck, provided the key path
        // is valid for the application's upper bound. Otherwise the property
        // definitely doesn't exist.
        const typeAtKeyPathInUpperBound = applyKeyPathToType(
          replaceAllTypeParametersWithTheirConstraints(applicationType),
          keyPath,
        )
        return (
            typeAtKeyPathInUpperBound.kind === 'union' &&
              typeAtKeyPathInUpperBound.members.size === 0
          ) ?
            nothing
          : nestedIndexedAccess(applicationType, [
              firstKey,
              ...remainingKeyPath,
            ])
      },
      intrinsicApplication: intrinsicApplicationType => {
        // As with `ApplicationType`s, indexing stays stuck while the key path
        // is valid for the upper bound. Otherwise the property doesn't exist.
        const typeAtKeyPathInUpperBound = applyKeyPathToType(
          replaceAllTypeParametersWithTheirConstraints(
            intrinsicApplicationType,
          ),
          keyPath,
        )
        return (
            typeAtKeyPathInUpperBound.kind === 'union' &&
              typeAtKeyPathInUpperBound.members.size === 0
          ) ?
            nothing
          : nestedIndexedAccess(intrinsicApplicationType, [
              firstKey,
              ...remainingKeyPath,
            ])
      },
      function: type => {
        if (typeof firstKey === 'string') {
          // Functions do not have properties.
          return nothing
        } else {
          switch (firstKey) {
            case functionParameterKey:
              return makeFunctionType({
                parameter: applyKeyPathToType(
                  type.signature.parameter,
                  remainingKeyPath,
                ),
                return: type.signature.return,
              })
            case functionReturnKey:
              return makeFunctionType({
                parameter: type.signature.parameter,
                return: applyKeyPathToType(
                  type.signature.return,
                  remainingKeyPath,
                ),
              })
            case typeParameterAssignableToConstraintKey:
              // Functions aren't type parameters.
              return nothing
          }
        }
      },
      object: type => {
        if (typeof firstKey === 'string') {
          const child = type.children[firstKey]
          if (child === undefined) {
            return nothing
          } else {
            return applyKeyPathToType(child, remainingKeyPath)
          }
        } else {
          // Objects have properties, not parameters/returns/constraints/etc.
          return nothing
        }
      },
      indexedAccess: type =>
        applyKeyPathToType(type.object, [firstKey, ...remainingKeyPath]),
      opaque: _type => nothing,
      parameter: type => {
        if (typeof firstKey === 'string') {
          // Indexing into a type parameter yields a stuck (object-neutral)
          // indexed access, kept dependent on the parameter so it can be reduced
          // once the parameter is instantiated. This is only done when the key
          // path is valid for the parameter's constraint; otherwise the property
          // genuinely doesn't exist.
          const typeAtKeyPathInConstraint = applyKeyPathToType(
            type.constraint.assignableTo,
            keyPath,
          )
          return (
              typeAtKeyPathInConstraint.kind === 'union' &&
                typeAtKeyPathInConstraint.members.size === 0
            ) ?
              nothing
            : nestedIndexedAccess(type, [firstKey, ...remainingKeyPath])
        } else {
          switch (firstKey) {
            case typeParameterAssignableToConstraintKey:
              return makeTypeParameter(type.name, {
                assignableTo: applyKeyPathToType(
                  type.constraint.assignableTo,
                  remainingKeyPath,
                ),
              })
            case functionParameterKey:
            case functionReturnKey:
              // Type parameters aren't function types, and drilling into the
              // constraint would lose precision.
              return nothing
          }
        }
      },
      union: type => {
        return makeUnionType(
          [...type.members].flatMap(member => {
            if (typeof member === 'string') {
              return []
            } else {
              const manipulatedMember = applyKeyPathToType(member, keyPath)
              if (manipulatedMember.kind === 'union') {
                return [...manipulatedMember.members]
              } else {
                return [manipulatedMember]
              }
            }
          }),
        )
      },
    })
  }
}

export const replaceAllTypeParametersWithTheirConstraints = (
  type: Type,
): Type =>
  type.kind === 'intrinsicApplication' ?
    replaceAllTypeParametersWithTheirConstraints(type.upperBound)
    // TODO: Specialize the below to only traverse `type` once.
  : [...containedTypeParameters(type).values()]
      .flatMap(({ typeParameters }) => [...typeParameters.members])
      .reduce<Type>(
        (partiallyAppliedType, typeParameter) =>
          supplyTypeArgument(
            partiallyAppliedType,
            typeParameter,
            typeParameter.constraint.assignableTo,
          ),
        type,
      )

/**
 * Finds concrete types for the `TypeParameter`s in `parameter` by locating the
 * corresponding position for each in `argument`.
 *
 * The types are not checked for consistency with each other, nor for
 * assignability to `argument`. Callers should use `supplyTypeArguments` to
 * create a concrete type and then perform any needed checks.
 */
export const getTypesForTypeParameters = ({
  parameterType,
  argumentType,
}: {
  readonly parameterType: Type
  readonly argumentType: Type
}): ReadonlyMap<TypeParameter, Type> => {
  // Avoid infinite recursion when we hit the top type.
  if (parameterType === something) {
    return new Map()
  } else if (argumentType.kind === 'intrinsicApplication') {
    return getTypesForTypeParameters({
      parameterType,
      argumentType: replaceAllTypeParametersWithTheirConstraints(argumentType),
    })
  } else {
    return matchTypeFormat(parameterType, {
      function: parameterType =>
        argumentType.kind === 'function' ?
          new Map([
            ...getTypesForTypeParameters({
              parameterType: parameterType.signature.return,
              argumentType: argumentType.signature.return,
            }),
            ...getTypesForTypeParameters({
              parameterType: parameterType.signature.parameter,
              argumentType: argumentType.signature.parameter,
            }),
          ])
        : new Map(),

      object: parameterType =>
        argumentType.kind === 'object' ?
          Object.entries(parameterType.children)
            .map(([key, childParameter]) => {
              const childArgument = argumentType.children[key]
              return childArgument === undefined ?
                  new Map<TypeParameter, Type>()
                : getTypesForTypeParameters({
                    parameterType: childParameter,
                    argumentType: childArgument,
                  })
            })
            .reduce(
              (types, typesFromChild) => new Map([...typesFromChild, ...types]),
              new Map<TypeParameter, Type>(),
            )
        : new Map(),

      opaque: _ => new Map(),

      // TODO: I don't think this case is solvable when the `IndexedAccessType`
      // is stuck on its key (e.g. `(?a: :b.:c)`), but when the key is concrete
      // I could perhaps use it to drill into the argument type. Is that sound?
      indexedAccess: _ => new Map(),

      // A application type in a function parameter is necessarily stuck on an
      // argument from an enclosing function that hasn't been applied, so no
      // bindings are inferred from it.
      application: _ => new Map(),

      // Likewise, a stuck intrinsic application yields no bindings.
      intrinsicApplication: _ => new Map(),

      parameter: parameterType =>
        (
          isAssignable({
            source: argumentType,
            target: parameterType.constraint.assignableTo,
          })
        ) ?
          new Map([[parameterType, argumentType]])
        : new Map(),

      union: parameterType => {
        const argumentCandidates = [
          argumentType,
          ...(argumentType.kind === 'union' ?
            // These additional candidates enable alignment between parameter
            // unions and argument unions. For example, given a `parameterType`
            // of `(A <: atom) | object` and an `argumentType` of `atom |
            // object`, `A` should be inferred as `atom`.
            [...argumentType.members].flatMap((member): readonly Type[] =>
              typeof member === 'string' ? [makeUnionType([member])] : [member],
            )
          : []),
        ] as const
        return [...parameterType.members]
          .flatMap(parameterMember =>
            typeof parameterMember === 'string' ?
              []
            : argumentCandidates
                .filter(candidate =>
                  isAssignable({
                    source: candidate,
                    target:
                      replaceAllTypeParametersWithTheirConstraints(
                        parameterMember,
                      ),
                  }),
                )
                .flatMap(candidate => [
                  ...getTypesForTypeParameters({
                    parameterType: parameterMember,
                    argumentType: candidate,
                  }),
                ]),
          )
          .reduce(
            (types, [parameter, type]) =>
              types.has(parameter) ? types : (
                new Map([...types, [parameter, type]])
              ),
            new Map<TypeParameter, Type>(),
          )
      },
    })
  }
}

/**
 * If `type` can be applied as a function, returns its signatures. Multiple
 * signatures may be returned if `type` is a union or a type parameter
 * constrained to a union. Returns `none` for anything that isn't applicable as
 * a function.
 */
export const applicableFunctionSignatures = (
  type: Type,
): Option<readonly FunctionType['signature'][]> =>
  matchTypeFormat(type, {
    function: type => option.makeSome([type.signature]),
    parameter: type =>
      applicableFunctionSignatures(type.constraint.assignableTo),
    union: type =>
      type.members.size === 0 ?
        option.none
      : [...type.members].reduce<Option<readonly FunctionType['signature'][]>>(
          (accumulated, member) =>
            option.flatMap(accumulated, signaturesSoFar =>
              typeof member === 'string' ?
                option.none
              : option.map(
                  applicableFunctionSignatures(member),
                  memberSignatures => [...signaturesSoFar, ...memberSignatures],
                ),
            ),
          option.makeSome([]),
        ),
    // A stuck application/indexed access is applicable when its upper bound is.
    application: type =>
      applicableFunctionSignatures(
        replaceAllTypeParametersWithTheirConstraints(type),
      ),
    indexedAccess: type =>
      applicableFunctionSignatures(
        replaceAllTypeParametersWithTheirConstraints(type),
      ),
    intrinsicApplication: type =>
      applicableFunctionSignatures(
        replaceAllTypeParametersWithTheirConstraints(type),
      ),
    object: _ => option.none,
    opaque: _ => option.none,
  })

/**
 * Attempt to reduce a (possibly stuck) application of `functionType(argument)`.
 * While the function still contains any of the `parametersStuckOn` (type
 * parameters an enclosing function will instantiate), the application stays
 * stuck. Once they're all gone the function is applied: any of its own type
 * parameters are bound from the argument, and type parameters appearing only in
 * the return legitimately remain.
 */
const reduceApplication = (
  functionType: Type,
  argumentType: Type,
  parametersStuckOn: ReadonlySet<symbol>,
): Type => {
  const stillStuckOnParameter = [
    ...typeParameterIdentitiesWithinType(functionType),
  ].some(identity => parametersStuckOn.has(identity))
  return !stillStuckOnParameter && functionType.kind === 'function' ?
      supplyTypeArguments(
        functionType.signature.return,
        getTypesForTypeParameters({
          parameterType: functionType.signature.parameter,
          argumentType: argumentType,
        }),
      )
    : makeApplicationType(functionType, argumentType, parametersStuckOn)
}

const cartesianProduct = <Element>(lists: readonly (readonly Element[])[]) =>
  lists.reduce<readonly (readonly Element[])[]>(
    (tuples, list) =>
      tuples.flatMap(tuple => list.map(value => [...tuple, value])),
    [[]],
  )

/**
 * Attempt to reduce a (possibly stuck) intrinsic application.
 */
const reduceIntrinsicApplication = (
  parameterTypes: readonly Type[],
  reduce: (
    argumentValues: readonly Atom[],
  ) => Either<FunctionNodeCallError, Type>,
  upperBound: Type,
): Type => {
  const argumentValues = parameterTypes.map(type =>
    type.kind !== 'union' ? option.none : asUnionWithLiteralAtomMembers(type),
  )
  const stuck = makeIntrinsicApplicationType(parameterTypes, reduce, upperBound)
  return option.match(option.sequence(argumentValues), {
    none: _ => stuck,
    some: argumentValues =>
      either.match(
        either.sequence(
          cartesianProduct(argumentValues.map(union => [...union.members])).map(
            reduce,
          ),
        ),
        {
          left: _ => stuck,
          right: resultTypes =>
            resultTypes.length === 1 && resultTypes[0] !== undefined ?
              resultTypes[0]
            : makeUnionType(
                resultTypes.flatMap(resultType =>
                  resultType.kind === 'union' ?
                    [...resultType.members]
                  : [resultType],
                ),
              ),
        },
      ),
  })
}

/**
 * Substitute the given `typeParameter` with the given `typeArgument` within
 * `type`, recursively visiting object properties, union members, etc.
 *
 * Note that this function does *not* check whether `typeArgument` is compatible
 * with the constraints of `typeParameter`.
 */
export const supplyTypeArgument = (
  type: Type,
  typeParameter: TypeParameter,
  typeArgument: Type,
): Type => {
  // Avoid infinite recursion when we hit the top type.
  if (type === something) {
    return type
  } else {
    return matchTypeFormat(type, {
      function: type =>
        makeFunctionType({
          parameter: supplyTypeArgument(
            type.signature.parameter,
            typeParameter,
            typeArgument,
          ),
          return: supplyTypeArgument(
            type.signature.return,
            typeParameter,
            typeArgument,
          ),
        }),
      object: type => {
        const substitutedChildren: Writable<ObjectType['children']> = {}
        for (const [key, child] of Object.entries(type.children)) {
          substitutedChildren[key] = supplyTypeArgument(
            child,
            typeParameter,
            typeArgument,
          )
        }
        return makeObjectType(substitutedChildren)
      },
      application: type =>
        reduceApplication(
          supplyTypeArgument(type.function, typeParameter, typeArgument),
          supplyTypeArgument(type.argument, typeParameter, typeArgument),
          type.parametersStuckOn,
        ),
      intrinsicApplication: type =>
        reduceIntrinsicApplication(
          type.parameterTypes.map(parameterType =>
            supplyTypeArgument(parameterType, typeParameter, typeArgument),
          ),
          type.reduce,
          supplyTypeArgument(type.upperBound, typeParameter, typeArgument),
        ),
      indexedAccess: type => {
        const substitutedKey = supplyTypeArgument(
          type.key,
          typeParameter,
          typeArgument,
        )
        // A stuck intrinsic application used as a key (e.g. an `atom.equals`
        // application) is reduced to its upper bound so indexing can proceed
        // (e.g. `{ false: …, true: … }[boolean]`).
        const keyForIndexing =
          substitutedKey.kind === 'intrinsicApplication' ?
            replaceAllTypeParametersWithTheirConstraints(substitutedKey)
          : substitutedKey
        return either.match(atomKeyPathComponentFromType(keyForIndexing), {
          left: _ =>
            // TODO: Should this trigger an error?
            nothing,
          right: key =>
            applyKeyPathToType(
              supplyTypeArgument(type.object, typeParameter, typeArgument),
              [key],
            ),
        })
      },
      opaque: type => type,
      parameter: type =>
        type.identity === typeParameter.identity ? typeArgument : type,
      union: type =>
        makeUnionType(
          [...type.members].flatMap(member => {
            if (typeof member === 'string') {
              return member
            } else {
              const substitutedMember = supplyTypeArgument(
                member,
                typeParameter,
                typeArgument,
              )
              return substitutedMember.kind === 'union' ?
                  [...substitutedMember.members]
                : [substitutedMember]
            }
          }),
        ),
    })
  }
}

/** @see `supplyTypeArgument` */
// TODO: If this becomes a performance bottleneck it could be specialized to
// only match the format of `type` once.
export const supplyTypeArguments = (
  type: Type,
  typeArguments: ReadonlyMap<TypeParameter, Type>,
): Type =>
  [...typeArguments].reduce(
    (partiallyAppliedType, [typeParameter, typeArgument]) =>
      supplyTypeArgument(partiallyAppliedType, typeParameter, typeArgument),
    type,
  )
