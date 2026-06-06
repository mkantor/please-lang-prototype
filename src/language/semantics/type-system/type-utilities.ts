import either, { type Either } from '@matt.kantor/either'
import option, { type Option } from '@matt.kantor/option'
import type { Writable } from '../../../utility-types.js'
import type { Bug, ElaborationError, TypeMismatchError } from '../../errors.js'
import type { Atom } from '../../parsing.js'
import { quoteAtomIfNecessary } from '../../unparsing/plz-utilities.js'
import type { ExpressionContext } from '../expression-elaboration.js'
import { isKeywordExpressionWithArgument } from '../expression.js'
import {
  getHoleTypeParameter,
  readHoleExpression,
} from '../expressions/hole-expression.js'
import type { ObjectNode } from '../object-node.js'
import { type SemanticGraph } from '../semantic-graph.js'
import { types } from '../type-system.js'
import { typesBySymbol } from './prelude-types.js'
import { isAssignable, simplifyUnionType } from './subtyping.js'
import {
  makeApplicationType,
  makeFunctionType,
  makeIndexedAccessType,
  makeObjectType,
  makeTypeParameter,
  makeUnionType,
  matchTypeFormat,
  type FunctionType,
  type IndexedAccessType,
  type ObjectType,
  type Type,
  type TypeParameter,
  type UnionType,
} from './type-formats.js'

export const functionParameterKey = Symbol('functionParameter')
export const functionReturnKey = Symbol('functionReturn')
export const typeParameterAssignableToConstraintKey = Symbol(
  'typeParameterAssignableToConstraint',
)

type AtomKeyPathComponent =
  | Atom
  | (Omit<UnionType, 'members'> & { readonly members: ReadonlySet<Atom> })
  | (TypeParameter & {
      readonly constraint: { readonly assignableTo: AtomKeyPathComponent }
    })

export type TypeKeyPath = readonly (
  | AtomKeyPathComponent
  | typeof functionParameterKey
  | typeof functionReturnKey
  | typeof typeParameterAssignableToConstraintKey
)[]

export const typeKeyPathFromObjectNode = (
  node: ObjectNode,
  context: ExpressionContext,
  inferType: (
    specificKey: SemanticGraph,
    contextForSpecificKey: ExpressionContext,
  ) => Either<ElaborationError, Type>,
): Either<ElaborationError, TypeKeyPath> =>
  // Each sequentially-keyed property is either a literal atom or a dynamic key
  // whose type must be an atom or union of atoms.
  either.sequence(
    Object.entries(node).map(([key, component]) =>
      typeof component === 'string' ?
        either.makeRight(component)
      : either.flatMap(
          inferType(component, {
            ...context,
            location: [...context.location, key],
          }),
          atomKeyPathComponentFromType,
        ),
    ),
  )

type StringifiedKeyPath = string // this could be branded if that seems useful
type UnionOfTypeParameters = Omit<UnionType, 'members'> & {
  readonly members: ReadonlySet<TypeParameter>
}
export type TypeParametersByKeyPath = Map<
  StringifiedKeyPath,
  {
    readonly keyPath: TypeKeyPath
    readonly typeParameters: UnionOfTypeParameters
  }
>

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
      // TODO: Recurse into the application's reduction once that's reachable.
      application: _type => types.nothing,
      function: type => {
        if (typeof firstKey === 'string') {
          // Functions do not have properties.
          return types.nothing
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
              return types.nothing
          }
        }
      },
      object: type => {
        if (typeof firstKey === 'string') {
          const child = type.children[firstKey]
          if (child === undefined) {
            return types.nothing
          } else {
            return applyKeyPathToType(child, remainingKeyPath)
          }
        } else {
          // Objects have properties, not parameters/returns/constraints/etc.
          return types.nothing
        }
      },
      indexedAccess: type =>
        applyKeyPathToType(type.object, [firstKey, ...remainingKeyPath]),
      opaque: _type => types.nothing,
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
              types.nothing
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
              // Type parameters aren't function types.
              // TODO: Though perhaps I should drill into the constraint here?
              return types.nothing
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

/**
 * Traverse a function parameter type annotation, replacing each opaque or union
 * leaf with a fresh `TypeParameter` constrained to the leaf. This is used to
 * make functions implicitly generic, even when annotated. For example:
 *
 * ```plz
 * ((x: { a: :integer.type }) => :x.a)({ a: 42 }) ~ 42
 * ```
 */
export const genericizeFunctionParameterAnnotation = (
  parameterName: Atom,
  annotationType: Type,
): Type =>
  genericizeFunctionParameterAnnotationAtKeyPath(
    parameterName,
    annotationType,
    [],
  )

const genericizeFunctionParameterAnnotationAtKeyPath = (
  parameterName: Atom,
  type: Type,
  keyPath: TypeKeyPath,
): Type =>
  matchTypeFormat(type, {
    function: (type): Type =>
      makeFunctionType({
        parameter: genericizeFunctionParameterAnnotationAtKeyPath(
          parameterName,
          type.signature.parameter,
          [...keyPath, functionParameterKey],
        ),
        return: genericizeFunctionParameterAnnotationAtKeyPath(
          parameterName,
          type.signature.return,
          [...keyPath, functionReturnKey],
        ),
      }),
    object: type =>
      makeObjectType(
        Object.fromEntries(
          Object.entries(type.children).map(
            ([key, child]) =>
              [
                key,
                genericizeFunctionParameterAnnotationAtKeyPath(
                  parameterName,
                  child,
                  [...keyPath, key],
                ),
              ] as const,
          ),
        ),
      ),
    opaque: leafType =>
      makeTypeParameter(synthesizeTypeParameterName(parameterName, keyPath), {
        assignableTo: leafType,
      }),
    parameter: leafType => leafType,
    application: leafType => leafType,
    indexedAccess: leafType => leafType,
    union: leafType =>
      makeTypeParameter(synthesizeTypeParameterName(parameterName, keyPath), {
        assignableTo: leafType,
      }),
  })

const synthesizeTypeParameterName = (
  parameterName: Atom,
  keyPath: TypeKeyPath,
): string => parameterName.concat(stringifyTypeKeyPathForEndUser(keyPath))

export const containedTypeParameters = (type: Type): TypeParametersByKeyPath =>
  containedTypeParametersImplementation(type, [])

const containedTypeParametersImplementation = (
  type: Type,
  root: TypeKeyPath,
): TypeParametersByKeyPath => {
  // Avoid infinite recursion when we hit the top type.
  if (type === types.something) {
    return new Map()
  } else {
    return matchTypeFormat<TypeParametersByKeyPath>(type, {
      function: ({ signature }) =>
        mergeTypeParametersByKeyPath(
          containedTypeParametersImplementation(signature.parameter, [
            ...root,
            functionParameterKey,
          ]),
          containedTypeParametersImplementation(signature.return, [
            ...root,
            functionReturnKey,
          ]),
        ),
      object: type =>
        Object.entries(type.children)
          .map(([key, child]) =>
            containedTypeParametersImplementation(child, [...root, key]),
          )
          .reduce(mergeTypeParametersByKeyPath, new Map()),
      application: type =>
        mergeTypeParametersByKeyPath(
          containedTypeParametersImplementation(type.function, root),
          containedTypeParametersImplementation(type.argument, root),
        ),
      indexedAccess: type =>
        mergeTypeParametersByKeyPath(
          containedTypeParametersImplementation(type.object, root),
          containedTypeParametersImplementation(type.key, root),
        ),
      opaque: _ => new Map(),
      parameter: type =>
        mergeTypeParametersByKeyPath(
          containedTypeParametersImplementation(type.constraint.assignableTo, [
            ...root,
            typeParameterAssignableToConstraintKey,
          ]),
          new Map([
            [
              stringifyTypeKeyPathForEndUser(root),
              {
                keyPath: root,
                typeParameters: makeUnionType([type]),
              },
            ],
          ]),
        ),
      union: ({ members }) =>
        [...members]
          .map(member =>
            typeof member === 'string' ?
              new Map()
            : containedTypeParametersImplementation(member, root),
          )
          .reduce(mergeTypeParametersByKeyPath, new Map()),
    })
  }
}

export const findKeyPathsToTypeParameter = (
  type: Type,
  typeParameterToFind: TypeParameter,
): Set<TypeKeyPath> =>
  findKeyPathsToTypeParameterImplementation(type, typeParameterToFind, [])

const findKeyPathsToTypeParameterImplementation = (
  type: Type,
  typeParameterToFind: TypeParameter,
  root: TypeKeyPath,
): Set<TypeKeyPath> => {
  // Avoid infinite recursion when we hit the top type.
  if (type === types.something) {
    return new Set()
  } else {
    return matchTypeFormat(type, {
      function: ({ signature }) =>
        new Set([
          ...findKeyPathsToTypeParameterImplementation(
            signature.parameter,
            typeParameterToFind,
            [...root, functionParameterKey],
          ),
          ...findKeyPathsToTypeParameterImplementation(
            signature.return,
            typeParameterToFind,
            [...root, functionReturnKey],
          ),
        ]),
      object: type =>
        Object.entries(type.children)
          .map(([key, child]) =>
            findKeyPathsToTypeParameterImplementation(
              child,
              typeParameterToFind,
              [...root, key],
            ),
          )
          .reduce(
            (accumulator, paths) => new Set([...accumulator, ...paths]),
            new Set(),
          ),
      application: type =>
        new Set([
          ...findKeyPathsToTypeParameterImplementation(
            type.function,
            typeParameterToFind,
            root,
          ),
          ...findKeyPathsToTypeParameterImplementation(
            type.argument,
            typeParameterToFind,
            root,
          ),
        ]),
      indexedAccess: type =>
        new Set([
          ...findKeyPathsToTypeParameterImplementation(
            type.object,
            typeParameterToFind,
            root,
          ),
          ...findKeyPathsToTypeParameterImplementation(
            type.key,
            typeParameterToFind,
            root,
          ),
        ]),
      opaque: _ => new Set(),
      parameter: type =>
        new Set([
          ...findKeyPathsToTypeParameterImplementation(
            type.constraint.assignableTo,
            typeParameterToFind,
            [...root, typeParameterAssignableToConstraintKey],
          ),
          ...(type.identity === typeParameterToFind.identity ? [root] : []),
        ]),
      union: ({ members }) =>
        [...members]
          .map(
            (member): Set<TypeKeyPath> =>
              typeof member === 'string' ?
                new Set()
              : findKeyPathsToTypeParameterImplementation(
                  member,
                  typeParameterToFind,
                  root,
                ),
          )
          .reduce(
            (accumulator, paths) => new Set([...accumulator, ...paths]),
            new Set(),
          ),
    })
  }
}

export const replaceAllTypeParametersWithTheirConstraints = (
  type: Type,
): Type =>
  // TODO: Specialize this implementation to only traverse `type` once
  [...containedTypeParameters(type).values()]
    .flatMap(({ typeParameters }) => [...typeParameters.members])
    .reduce(
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
  if (parameterType === types.something) {
    return new Map()
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

export const typeParameterIdentitiesWithinType = (
  type: Type,
): ReadonlySet<symbol> =>
  new Set(
    [...containedTypeParameters(type).values()].flatMap(({ typeParameters }) =>
      [...typeParameters.members].map(typeParameter => typeParameter.identity),
    ),
  )

/**
 * If `type` is something that can be applied, return its signature.
 */
export const applicableFunctionSignature = (
  type: Type,
): Option<FunctionType['signature']> =>
  type.kind === 'function' ? option.makeSome(type.signature)
  : (
    type.kind === 'parameter' &&
    type.constraint.assignableTo.kind === 'function'
  ) ?
    option.makeSome(type.constraint.assignableTo.signature)
  : option.none

/**
 * Attempt to reduce a (possibly stuck) application of `functionType(argument)`.
 * While the function still contains any of the `flexibleParameters` (type
 * parameters an enclosing function will instantiate), the application stays
 * stuck. Once they're all gone the function is applied: any of its own type
 * parameters are bound from the argument, and type parameters appearing only in
 * the return legitimately remain.
 */
const reduceApplication = (
  functionType: Type,
  argumentType: Type,
  flexibleParameters: ReadonlySet<symbol>,
): Type => {
  const stillAwaitingFlexibleParameter = [
    ...typeParameterIdentitiesWithinType(functionType),
  ].some(identity => flexibleParameters.has(identity))
  return !stillAwaitingFlexibleParameter && functionType.kind === 'function' ?
      supplyTypeArguments(
        functionType.signature.return,
        getTypesForTypeParameters({
          parameterType: functionType.signature.parameter,
          argumentType: argumentType,
        }),
      )
    : makeApplicationType(functionType, argumentType, flexibleParameters)
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
  if (type === types.something) {
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
          type.flexibleParameters,
        ),
      indexedAccess: type =>
        either.match(
          atomKeyPathComponentFromType(
            supplyTypeArgument(type.key, typeParameter, typeArgument),
          ),
          {
            left: _ =>
              // TODO: Should this trigger an error?
              types.nothing,
            right: key =>
              applyKeyPathToType(
                supplyTypeArgument(type.object, typeParameter, typeArgument),
                [key],
              ),
          },
        ),
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

/**
 * If the given `KeyPath` is not valid for the given `Type`, the given `Type` is
 * returned unchanged (and `operation` is never called).
 */
export const updateTypeAtKeyPathIfValid = (
  type: Type,
  keyPath: TypeKeyPath,
  // TODO: `operation` should be able to update `Atom`s.
  operation: (typeAtKeyPath: Exclude<Type, UnionType>) => Type,
): Type => {
  const [firstKey, ...remainingKeyPath] = keyPath
  if (firstKey === undefined) {
    // If the key path is empty, this is the type to operate on.
    if (type.kind === 'union') {
      return makeUnionType(
        [...type.members].flatMap(member => {
          if (typeof member === 'string') {
            return member
          } else {
            const result = operation(member)
            if (result.kind === 'union') {
              return [...result.members]
            } else {
              return [result]
            }
          }
        }),
      )
    } else {
      return operation(type)
    }
  } else {
    return matchTypeFormat<Type>(type, {
      function: type => {
        switch (firstKey) {
          case functionParameterKey:
            return makeFunctionType({
              parameter: updateTypeAtKeyPathIfValid(
                type.signature.parameter,
                remainingKeyPath,
                operation,
              ),
              return: type.signature.return,
            })
          case functionReturnKey:
            return makeFunctionType({
              return: updateTypeAtKeyPathIfValid(
                type.signature.return,
                remainingKeyPath,
                operation,
              ),
              parameter: type.signature.parameter,
            })
          default:
            return type
        }
      },
      application: type => type,
      indexedAccess: type => type,
      object: type => {
        if (typeof firstKey === 'string') {
          const next = type.children[firstKey]
          if (next === undefined) {
            return type
          } else {
            return makeObjectType({
              ...type.children,
              [firstKey]: updateTypeAtKeyPathIfValid(
                next,
                remainingKeyPath,
                operation,
              ),
            })
          }
        } else {
          return type
        }
      },
      opaque: type => type,
      parameter: type => {
        switch (firstKey) {
          case typeParameterAssignableToConstraintKey:
            return makeTypeParameter(type.name, {
              assignableTo: updateTypeAtKeyPathIfValid(
                type.constraint.assignableTo,
                remainingKeyPath,
                operation,
              ),
            })
          default:
            return type
        }
      },
      union: type =>
        makeUnionType(
          [...type.members].flatMap(member => {
            if (typeof member === 'string') {
              return []
            } else {
              const manipulatedMember = updateTypeAtKeyPathIfValid(
                member,
                keyPath,
                operation,
              )
              if (manipulatedMember.kind === 'union') {
                return [...manipulatedMember.members]
              } else {
                return [manipulatedMember]
              }
            }
          }),
        ),
    })
  }
}

export const literalTypeFromSemanticGraph = (
  node: SemanticGraph,
): Either<Bug, Type> => {
  if (typeof node === 'string') {
    return either.makeRight({
      kind: 'union',
      members: new Set([node]),
    })
  } else if (typeof node === 'symbol') {
    if (node in typesBySymbol) {
      return either.makeRight(typesBySymbol[node])
    } else {
      return either.makeLeft({
        kind: 'bug',
        message: 'semantic graph contained an unknown symbol',
      })
    }
  } else if (typeof node === 'function') {
    return either.makeRight({
      kind: 'function',
      signature: node.signature,
    })
  } else {
    // TODO: It would be nice to use `readUnionExpression` here, but directly
    // importing values from the *-expression.ts modules causes a dependency
    // cycle. This needs investigation.
    if (isKeywordExpressionWithArgument('@union', node)) {
      return either.map(
        either.sequence(
          Object.values(node[1]).map(literalTypeFromSemanticGraph),
        ),
        memberTypes =>
          makeUnionType(
            memberTypes.flatMap(memberType =>
              memberType.kind === 'union' ?
                [...memberType.members]
              : [memberType],
            ),
          ),
      )
    } else if (isKeywordExpressionWithArgument('@hole', node)) {
      return either.mapLeft(
        either.map(readHoleExpression(node), getHoleTypeParameter),
        error => ({
          kind: 'bug',
          message: '`@hole` expression was invalid',
          cause: error,
        }),
      )
    } else {
      // `node` is an object type.
      return either.map(
        either.sequence(
          Object.entries(node).map(([key, value]) =>
            either.map(literalTypeFromSemanticGraph(value), childType => [
              key,
              childType,
            ]),
          ),
        ),
        entries => makeObjectType(Object.fromEntries(entries)),
      )
    }
  }
}

const mergeTypeParametersByKeyPath = (
  a: TypeParametersByKeyPath,
  b: TypeParametersByKeyPath,
): TypeParametersByKeyPath => {
  const result: TypeParametersByKeyPath = new Map()
  // Merge entries present in `a` with any corresponding entry in `b`.
  for (const [key, { keyPath, typeParameters }] of a) {
    const valueFromB = b.get(key)
    if (valueFromB === undefined) {
      result.set(key, { keyPath, typeParameters })
    } else {
      // Merge all type(s) at this key path into a (simplified) union.
      const supposedTypeParametersAsArray = [
        ...simplifyUnionType(
          makeUnionType([
            ...typeParameters.members,
            ...valueFromB.typeParameters.members,
          ]),
        ).members.values(),
      ]
      if (
        !supposedTypeParametersAsArray.every(
          supposedTypeParameter =>
            typeof supposedTypeParameter !== 'string' &&
            supposedTypeParameter.kind == 'parameter',
        )
      ) {
        throw new Error(
          'Union type member was unexpectedly not a type parameter. This is a bug!',
        )
      }

      result.set(key, {
        keyPath,
        typeParameters: makeUnionType(supposedTypeParametersAsArray),
      })
    }
  }
  // Add any leftovers present in `b`.
  for (const [key, value] of b) {
    if (!result.has(key)) {
      result.set(key, value)
    }
  }
  return result
}

export const stringifyTypeKeyPathForEndUser = (keyPath: TypeKeyPath): string =>
  // TODO: Would be nice to use unparser machinery here.
  keyPath.reduce(
    (stringifiedTypeKeyPath: string, key) =>
      stringifiedTypeKeyPath.concat(
        '.',
        stringifyKeyPathComponentForEndUser(key),
      ),
    '',
  )

const atomKeyPathComponentFromType = (
  type: Type,
): Either<TypeMismatchError, AtomKeyPathComponent> =>
  matchTypeFormat<Either<TypeMismatchError, AtomKeyPathComponent>>(type, {
    application: _ =>
      either.makeLeft({
        kind: 'typeMismatch',
        message: `${type.kind} types are not valid key path components`,
      }),
    function: _ =>
      either.makeLeft({
        kind: 'typeMismatch',
        message: `${type.kind} types are not valid key path components`,
      }),
    indexedAccess: _ =>
      either.makeLeft({
        kind: 'typeMismatch',
        message: `${type.kind} types are not valid key path components`,
      }),
    object: _ =>
      either.makeLeft({
        kind: 'typeMismatch',
        message: `${type.kind} types are not valid key path components`,
      }),
    opaque: _ =>
      either.makeLeft({
        kind: 'typeMismatch',
        message: `${type.kind} types are not valid key path components`,
      }),
    parameter: type => {
      switch (type.constraint.assignableTo.kind) {
        case 'application':
        case 'function':
        case 'indexedAccess':
        case 'object':
        case 'opaque':
          return either.makeLeft({
            kind: 'typeMismatch',
            message: `type parameters constrained to ${type.constraint.assignableTo.kind} types aren't valid key path components`,
          })
        case 'union':
        case 'parameter':
          return either.map(
            atomKeyPathComponentFromType(type.constraint.assignableTo),
            validAssignableTo => ({
              ...type,
              constraint: {
                ...type.constraint,
                assignableTo:
                  typeof validAssignableTo === 'string' ?
                    makeUnionType([validAssignableTo])
                  : validAssignableTo,
              },
            }),
          )
      }
    },
    union: type => {
      const [firstAtom, ...remainingAtoms] = [...type.members]
      return (
        firstAtom === undefined ?
          either.makeLeft({
            kind: 'typeMismatch',
            message: `union types are only valid key path components if they are non-empty`,
          })
        : remainingAtoms.length === 0 && typeof firstAtom === 'string' ?
          // Unwrap single-member unions.
          either.makeRight(firstAtom)
        : option.match(asUnionWithLiteralAtomMembers(type), {
            none: _ =>
              either.makeLeft({
                kind: 'typeMismatch',
                message: `union types are only valid key path components when all their members are literal atoms`,
              }),
            some: either.makeRight,
          })
      )
    },
  })

/**
 * Returns a narrowed version of the `UnionType` if all of its members are
 * literal atom types.
 */
const asUnionWithLiteralAtomMembers = (
  type: UnionType,
): Option<
  Omit<UnionType, 'members'> & { readonly members: ReadonlySet<Atom> }
> => {
  const simplifiedType = simplifyUnionType(type)

  const atomMembers = [...simplifiedType.members].filter(
    member => typeof member === 'string',
  )

  const isAtomUnion = atomMembers.length === simplifiedType.members.size

  return !isAtomUnion ?
      option.none
    : option.makeSome(makeUnionType(atomMembers))
}

const indexedAccessFromTypeKeyPathEntry = (
  object: Type,
  key: TypeKeyPath[number],
): IndexedAccessType => {
  if (typeof key === 'symbol') {
    // TODO: Seems like this should either be allowed
    // (`IndexedAccessType['key']` could be typed as `TypeKeyPath[number]`?) or
    // handled better (this function could return an `Either`).
    throw new Error(
      'Type key path contained a symbol following a parameter. This is a bug!',
    )
  } else {
    return makeIndexedAccessType(
      object,
      typeof key === 'string' ? makeUnionType([key]) : key,
    )
  }
}

/**
 * Build a left-nested `IndexedAccessType` projecting `keyPath` out of `object`.
 */
const nestedIndexedAccess = (
  object: Type,
  keyPath: readonly [TypeKeyPath[number], ...TypeKeyPath],
): IndexedAccessType => {
  const [firstKey, ...remainingKeyPath] = keyPath
  const firstIndexedAccess = indexedAccessFromTypeKeyPathEntry(object, firstKey)
  return remainingKeyPath.reduce(
    indexedAccessFromTypeKeyPathEntry,
    firstIndexedAccess,
  )
}

const stringifyKeyPathComponentForEndUser = (
  component: TypeKeyPath[number],
): string => {
  if (typeof component === 'string') {
    return quoteAtomIfNecessary(component)
  } else if (typeof component === 'object') {
    switch (component.kind) {
      case 'parameter':
        return `?${component.name}`
      case 'union':
        return '('.concat(
          [...component.members]
            .sort()
            .map(stringifyKeyPathComponentForEndUser)
            .join(' | '),
          ')',
        )
    }
  } else {
    switch (component) {
      // TODO: Consider surfacing this in plz syntax (allowing programmatic
      // access of un-elaborated function parameters/returns and type parameter
      // constraints).
      case functionParameterKey:
        return '#parameter'
      case functionReturnKey:
        return '#return'
      case typeParameterAssignableToConstraintKey:
        return '#constraint'
    }
  }
}
