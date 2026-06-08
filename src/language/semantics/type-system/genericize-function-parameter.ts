import type { Atom } from '../../parsing.js'
import {
  makeFunctionType,
  makeObjectType,
  makeTypeParameter,
  matchTypeFormat,
  type Type,
} from './type-formats.js'
import {
  functionParameterKey,
  functionReturnKey,
  stringifyTypeKeyPathForEndUser,
  type TypeKeyPath,
} from './type-key-path.js'

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
    intrinsicApplication: leafType => leafType,
    union: leafType =>
      makeTypeParameter(synthesizeTypeParameterName(parameterName, keyPath), {
        assignableTo: leafType,
      }),
  })

const synthesizeTypeParameterName = (
  parameterName: Atom,
  keyPath: TypeKeyPath,
): string => parameterName.concat(stringifyTypeKeyPathForEndUser(keyPath))
