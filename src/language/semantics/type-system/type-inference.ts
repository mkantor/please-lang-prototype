import either, { type Either } from '@matt.kantor/either'
import option from '@matt.kantor/option'
import type { Bug, ElaborationError } from '../../errors.js'
import type { Atom } from '../../parsing.js'
import {
  applyKeyPathToSemanticGraph,
  containsAnyUnelaboratedNodes,
  getParameterName,
  isAssignable,
  isExpression,
  isFunctionNode,
  isObjectNode,
  keyPathFromObjectNodeOrMolecule,
  lookup,
  readApplyExpression,
  readFunctionExpression,
  readIfExpression,
  readIndexExpression,
  readLookupExpression,
  readPanicExpression,
  readRuntimeExpression,
  type ExpressionContext,
  type KeyPath,
  type SemanticGraph,
} from '../../semantics.js'
import { isKeywordExpressionWithArgument } from '../../semantics/expression.js'
import {
  getParameterTypeAnnotation,
  type FunctionExpression,
} from '../expressions/function-expression.js'
import * as types from './prelude-types.js'
import {
  makeFunctionType,
  makeObjectType,
  makeUnionType,
  type Type,
} from './type-formats.js'
import {
  applyKeyPathToType,
  genericizeFunctionParameterAnnotation,
  getTypesForTypeParameters,
  literalTypeFromSemanticGraph,
  supplyTypeArguments,
} from './type-utilities.js'

/**
 * Returns a `Map` of parameter names to their types for the function parameters
 * that are in scope for the given `context`'s `location`.
 */
export const resolveParameterTypes = (
  context: ExpressionContext,
): ReadonlyMap<Atom, Type> => {
  const parameterTypes = new Map<Atom, Type>()
  let currentLocation = context.location

  // Walk upwards towards the program root, keeping track of parameter names and
  // their types.
  while (currentLocation.length >= 2) {
    const pathToCurrentScope = currentLocation.slice(0, -1)
    const pathToParentScope = pathToCurrentScope.slice(0, -1)

    const parentNodeOption = applyKeyPathToSemanticGraph(
      context.program,
      pathToParentScope,
    )

    if (
      option.isSome(parentNodeOption) &&
      isExpression(parentNodeOption.value)
    ) {
      const lastKey = pathToCurrentScope[pathToCurrentScope.length - 1]
      if (lastKey === '1') {
        const functionResult = readFunctionExpression(parentNodeOption.value)
        if (either.isRight(functionResult)) {
          const parameterName = getParameterName(functionResult.value)
          if (!parameterTypes.has(parameterName)) {
            const parameterTypeResult = getFunctionParameterType(
              functionResult.value,
              {
                keywordHandlers: context.keywordHandlers,
                program: context.program,
                location: currentLocation,
              },
            )
            // Ignore errors here (they should be surfaced elsewhere).
            if (either.isRight(parameterTypeResult)) {
              // Side-effect: add the parameter.
              parameterTypes.set(parameterName, parameterTypeResult.value)
            }
          }
        }
      }
      currentLocation = pathToParentScope
    } else {
      currentLocation = pathToCurrentScope
    }
  }

  return parameterTypes
}

export const inferType = (
  node: SemanticGraph,
  parameterTypes: ReadonlyMap<Atom, Type>,
  lookingUpKeys: ReadonlySet<Atom>,
  context: ExpressionContext,
): Either<ElaborationError, Type> => {
  if (
    typeof node === 'string' ||
    typeof node === 'symbol' ||
    typeof node === 'function'
  ) {
    return literalTypeFromSemanticGraph(node)
  }

  // @function: infer return type from the body.
  const functionExpressionResult = readFunctionExpression(node)
  if (either.isRight(functionExpressionResult)) {
    return either.flatMap(
      getFunctionParameterType(functionExpressionResult.value, context),
      parameterType =>
        either.map(
          inferType(
            functionExpressionResult.value[1].body,
            new Map([
              ...parameterTypes,
              [getParameterName(functionExpressionResult.value), parameterType],
            ]),
            lookingUpKeys,
            context,
          ),
          returnType =>
            makeFunctionType('', {
              parameter: parameterType,
              return: returnType,
            }),
        ),
    )
  }

  // @lookup: check if it directly refers to a function parameter. If so, use
  // the parameter's type. Otherwise, resolve the @lookup, then recur.
  const lookupExpressionResult = readLookupExpression(node)
  if (either.isRight(lookupExpressionResult)) {
    const key = lookupExpressionResult.value[1].key
    const paramType = parameterTypes.get(key)
    if (paramType !== undefined) {
      return either.makeRight(paramType)
    } else if (!lookingUpKeys.has(key)) {
      const lookupResult = lookup({ key, context })
      if (either.isRight(lookupResult) && option.isSome(lookupResult.value)) {
        return inferType(
          lookupResult.value.value,
          parameterTypes,
          new Set([...lookingUpKeys, key]),
          context,
        )
      } else {
        // Fall back to the top type.
        return either.makeRight(types.something)
      }
    } else {
      // Fall back to the top type.
      return either.makeRight(types.something)
    }
  }

  // @index: infer object type, look up appropriate type by key path.
  const indexExpressionResult = readIndexExpression(node)
  if (either.isRight(indexExpressionResult)) {
    return either.flatMap(
      inferType(
        indexExpressionResult.value[1].object,
        parameterTypes,
        lookingUpKeys,
        context,
      ),
      objectType =>
        either.map(
          keyPathFromObjectNodeOrMolecule(indexExpressionResult.value[1].query),
          keyPath => applyKeyPathToType(objectType, keyPath),
        ),
    )
  }

  // @runtime: infer return type of the contained function.
  const runtimeExpressionResult = readRuntimeExpression(node)
  if (either.isRight(runtimeExpressionResult)) {
    const runtimeFunction = runtimeExpressionResult.value[1].function
    const functionExpressionResult =
      isFunctionNode(runtimeFunction) ?
        either.flatMap(runtimeFunction.serialize(), readFunctionExpression)
      : readFunctionExpression(runtimeFunction)
    if (either.isRight(functionExpressionResult)) {
      return inferType(
        functionExpressionResult.value[1].body,
        new Map([
          ...parameterTypes,
          [
            getParameterName(functionExpressionResult.value),
            types.runtimeContext,
          ],
        ]),
        lookingUpKeys,
        context,
      )
    } else {
      return either.makeLeft({
        kind: 'invalidExpression',
        message: '@runtime function was not a function',
      })
    }
  }

  // @apply: infer the return type from the function being applied.
  const applyExpressionResult = readApplyExpression(node)
  if (either.isRight(applyExpressionResult)) {
    const inferredFunctionType = inferType(
      applyExpressionResult.value[1].function,
      parameterTypes,
      lookingUpKeys,
      context,
    )
    if (either.isRight(inferredFunctionType)) {
      const inferredFunctionTypeAsFunctionType =
        inferredFunctionType.value.kind === 'function' ?
          option.makeSome(inferredFunctionType.value)
        : (
          inferredFunctionType.value.kind === 'parameter' &&
          inferredFunctionType.value.constraint.assignableTo.kind === 'function'
        ) ?
          option.makeSome(inferredFunctionType.value.constraint.assignableTo)
        : option.none

      return option.match(inferredFunctionTypeAsFunctionType, {
        some: ({
          signature: { parameter: parameterType, return: returnType },
        }) => {
          const argumentTypeResult = inferType(
            applyExpressionResult.value[1].argument,
            parameterTypes,
            lookingUpKeys,
            context,
          )
          if (either.isRight(argumentTypeResult)) {
            // Supply type arguments to the return type based on the inferred
            // argument type.
            return either.makeRight(
              supplyTypeArguments(
                returnType,
                getTypesForTypeParameters({
                  parameterType,
                  argumentType: argumentTypeResult.value,
                }),
              ),
            )
          }
          return either.makeRight(returnType)
        },
        none: _ => either.makeRight(types.something),
        // TODO: Error instead once inference is comprehensive enough to do so
        // without failing tests:
        // none: _ => either.makeLeft({
        //   kind: 'invalidExpression',
        //   message: `cannot infer return type: only functions can be applied, but got a \`${showType(inferredFunctionType.value)}\``,
        // }),
      })
    }
  }

  // @if: narrow to the chosen branch when the condition is statically known
  // to be `true` or `false`; otherwise return a union of the branch types.
  const ifExpressionResult = readIfExpression(node)
  if (either.isRight(ifExpressionResult)) {
    const { condition, then, else: otherwise } = ifExpressionResult.value[1]

    const inferThen = () =>
      inferType(then, parameterTypes, lookingUpKeys, context)
    const inferElse = () =>
      inferType(otherwise, parameterTypes, lookingUpKeys, context)

    return either.flatMap(
      inferType(condition, parameterTypes, lookingUpKeys, context),
      conditionType => {
        if (isAssignable({ source: conditionType, target: 'true' })) {
          return inferThen()
        } else if (isAssignable({ source: conditionType, target: 'false' })) {
          return inferElse()
        } else {
          const membersOf = (type: Type) =>
            type.kind === 'union' ? [...type.members] : [type]
          return either.flatMap(inferThen(), thenType =>
            either.map(inferElse(), elseType =>
              makeUnionType('', [
                ...membersOf(thenType),
                ...membersOf(elseType),
              ]),
            ),
          )
        }
      },
    )
  }

  // @panic: infer the bottom type.
  const panicExpressionResult = readPanicExpression(node)
  if (either.isRight(panicExpressionResult)) {
    return either.makeRight(types.nothing)
  }

  if (isObjectNode(node) && containsAnyUnelaboratedNodes(node)) {
    // Infer unelaborated descendants' types.
    const children: Record<string, Type> = {}
    for (const [key, value] of Object.entries(node)) {
      const childTypeResult = inferType(
        value,
        parameterTypes,
        lookingUpKeys,
        context,
      )
      if (either.isLeft(childTypeResult)) {
        return childTypeResult
      }
      children[key] = childTypeResult.value
    }
    return either.makeRight(makeObjectType('', children))
  } else {
    return literalTypeFromSemanticGraph(node)
  }
}

/**
 * Functions are implicitly generic.
 *
 * With no explicit parameter annotation, a new type parameter (constrained to
 * the top type) is created for the function parameter. If there is an
 * annotation, it's used to create one or more type parameters with constraints
 * derived from the annotation (see `genericizeFunctionParameterAnnotation` for
 * specifics).
 */
const getFunctionParameterType = (
  expression: FunctionExpression,
  context: ExpressionContext,
): Either<Bug, Type> =>
  option.match(getParameterTypeAnnotation(expression), {
    some: annotation =>
      either.map(literalTypeFromSemanticGraph(annotation), annotationType =>
        genericizeFunctionParameterAnnotation(
          getParameterName(expression),
          annotationType,
        ),
      ),
    none: _ => {
      // TODO: Generalize contextual type inference of un-annotated parameters
      // (it currently only happens for `@runtime` functions).
      if (
        isEnclosedInRuntimeExpression(
          context.program,
          context.location.slice(0, -2),
        )
      ) {
        return either.makeRight(types.runtimeContext)
      } else {
        return either.makeRight(
          genericizeFunctionParameterAnnotation(
            getParameterName(expression),
            types.something,
          ),
        )
      }
    },
  })

const isEnclosedInRuntimeExpression = (
  program: SemanticGraph,
  pathToFunction: KeyPath,
): boolean => {
  if (pathToFunction.length < 2) {
    return false
  } else {
    const pathToPossibleRuntimeExpression = pathToFunction.slice(0, -2)
    return option.match(
      applyKeyPathToSemanticGraph(program, pathToPossibleRuntimeExpression),
      {
        none: () => false,
        some: node => isKeywordExpressionWithArgument('@runtime', node),
      },
    )
  }
}
