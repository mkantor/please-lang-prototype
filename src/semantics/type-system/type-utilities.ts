import type { Writable } from '../../utility-types.js'
import {
  functionParameter,
  functionReturn,
  typeParameterAssignableToConstraint,
  type KeyPath,
} from '../key-path.js'
import { types } from '../type-system.js'
import { simplifyUnionType } from './subtyping.js'
import {
  makeFunctionType,
  makeObjectType,
  makeTypeParameter,
  makeUnionType,
  matchTypeFormat,
  type ObjectType,
  type Type,
  type TypeParameter,
  type UnionType,
} from './type-formats.js'

type StringifiedKeyPath = string // this could be branded if that seems useful
type UnionOfTypeParameters = Omit<UnionType, 'members'> & {
  readonly members: ReadonlySet<TypeParameter>
}
export type TypeParametersByKeyPath = Map<
  StringifiedKeyPath,
  {
    readonly keyPath: KeyPath
    readonly typeParameters: UnionOfTypeParameters
  }
>

export const containedTypeParameters = (type: Type): TypeParametersByKeyPath =>
  containedTypeParametersImplementation(type, [])

const containedTypeParametersImplementation = (
  type: Type,
  root: KeyPath,
): TypeParametersByKeyPath => {
  // Avoid infinite recursion when we hit the top type.
  if (type === types.value) {
    return new Map()
  } else {
    return matchTypeFormat(type, {
      function: ({ signature }) =>
        mergeTypeParametersByKeyPath(
          containedTypeParametersImplementation(signature.parameter, [
            ...root,
            functionParameter,
          ]),
          containedTypeParametersImplementation(signature.return, [
            ...root,
            functionReturn,
          ]),
        ),
      object: type =>
        Object.entries(type.children)
          .map(([key, child]) =>
            containedTypeParametersImplementation(child, [...root, key]),
          )
          .reduce(mergeTypeParametersByKeyPath, new Map()),
      opaque: _ => new Map(),
      parameter: type =>
        mergeTypeParametersByKeyPath(
          containedTypeParametersImplementation(type.constraint.assignableTo, [
            ...root,
            typeParameterAssignableToConstraint,
          ]),
          new Map([
            [
              stringifyKeyPath(root),
              {
                keyPath: root,
                typeParameters:
                  // TODO: eliminate the type assertion, perhaps by making `makeUnionType` generic
                  // over the member type
                  makeUnionType('', [type]) as UnionOfTypeParameters,
              },
            ],
          ]),
        ),
      union: ({ members }) =>
        [...members]
          .map(
            (member): TypeParametersByKeyPath =>
              typeof member === 'string'
                ? new Map()
                : containedTypeParametersImplementation(member, root),
          )
          .reduce(mergeTypeParametersByKeyPath, new Map()),
    })
  }
}

export const findKeyPathsToTypeParameter = (
  type: Type,
  typeParameterToFind: TypeParameter,
): Set<KeyPath> =>
  findKeyPathsToTypeParameterImplementation(type, typeParameterToFind, [])

const findKeyPathsToTypeParameterImplementation = (
  type: Type,
  typeParameterToFind: TypeParameter,
  root: KeyPath,
): Set<KeyPath> => {
  // Avoid infinite recursion when we hit the top type.
  if (type === types.value) {
    return new Set()
  } else {
    return matchTypeFormat(type, {
      function: ({ signature }) =>
        new Set([
          ...findKeyPathsToTypeParameterImplementation(
            signature.parameter,
            typeParameterToFind,
            [...root, functionParameter],
          ),
          ...findKeyPathsToTypeParameterImplementation(
            signature.return,
            typeParameterToFind,
            [...root, functionReturn],
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
      opaque: _ => new Set(),
      parameter: type =>
        new Set([
          ...findKeyPathsToTypeParameterImplementation(
            type.constraint.assignableTo,
            typeParameterToFind,
            [...root, typeParameterAssignableToConstraint],
          ),
          ...(type.identity === typeParameterToFind.identity ? [root] : []),
        ]),
      union: ({ members }) =>
        [...members]
          .map(
            (member): Set<KeyPath> =>
              typeof member === 'string'
                ? new Set()
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

/**
 * Substitute the given `typeParameter` with the given `typeArgument` within `type`, recursively
 * visiting object properties, union members, etc.
 *
 * Note that this function does *not* check whether `typeArgument` is compatible with the
 * constraints of `typeParameter`.
 */
export const supplyTypeArgument = (
  type: Type,
  typeParameter: TypeParameter,
  typeArgument: Type,
): Type => {
  // Avoid infinite recursion when we hit the top type.
  if (type === types.value) {
    return type
  } else {
    return matchTypeFormat(type, {
      function: type =>
        makeFunctionType(type.name, {
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
        return makeObjectType(type.name, substitutedChildren)
      },
      opaque: type => type,
      parameter: type =>
        type.identity === typeParameter.identity ? typeArgument : type,
      union: type =>
        makeUnionType(
          type.name,
          [...type.members].flatMap(member => {
            if (typeof member === 'string') {
              return member
            } else {
              const substitutedMember = supplyTypeArgument(
                member,
                typeParameter,
                typeArgument,
              )
              return substitutedMember.kind === 'union'
                ? [...substitutedMember.members]
                : [substitutedMember]
            }
          }),
        ),
    })
  }
}

/**
 * If the given `KeyPath` is not valid for the given `Type`, the given `Type` is returned unchanged
 * (and `operation` is never called).
 */
export const updateTypeAtKeyPathIfValid = (
  type: Type,
  keyPath: KeyPath,
  // TODO: `operation` should be able to update `Atom`s
  operation: (typeAtKeyPath: Exclude<Type, UnionType>) => Type,
): Type => {
  const [firstKey, ...remainingKeyPath] = keyPath
  if (firstKey === undefined) {
    // If the key path is empty, this is the type to operate on.
    if (type.kind === 'union') {
      return makeUnionType(
        type.name,
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
    return matchTypeFormat(type, {
      function: type => {
        switch (firstKey) {
          case functionParameter:
            return makeFunctionType(type.name, {
              parameter: updateTypeAtKeyPathIfValid(
                type.signature.parameter,
                remainingKeyPath,
                operation,
              ),
              return: type.signature.return,
            })
          case functionReturn:
            return makeFunctionType(type.name, {
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
      object: type => {
        if (typeof firstKey === 'string') {
          const next = type.children[firstKey]
          if (next === undefined) {
            return type
          } else {
            return makeObjectType(type.name, {
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
      opaque: (type): Type => type,
      parameter: type => {
        switch (firstKey) {
          case typeParameterAssignableToConstraint:
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
          type.name,
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
      // Merge all type(s) at this key path into a union.
      result.set(key, {
        keyPath,
        typeParameters:
          // TODO: eliminate the type assertion, perhaps by making `makeUnionType` and
          // `simplifyUnionType` generic over their member types
          simplifyUnionType(
            makeUnionType(typeParameters.name, [
              ...typeParameters.members,
              ...valueFromB.typeParameters.members,
            ]),
          ) as UnionOfTypeParameters,
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

// The string format is not meant for human consumption. The only guarantee is that every distinct
// key path produces a unique string.
const stringifyKeyPath = (keyPath: KeyPath): string =>
  keyPath.reduce((stringifiedKeyPath: string, key) => {
    const stringifiedKey =
      typeof key === 'symbol' ? key.description : JSON.stringify(key)
    if (stringifiedKey === undefined) {
      throw new Error(
        'Symbol in key path does not have a description. This is a bug!',
      )
    }
    return `${stringifiedKeyPath}.${stringifiedKey}`
  }, '')
