import either, { type Either } from '@matt.kantor/either'
import option, { type Option } from '@matt.kantor/option'
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
    const enclosingFunction = option.flatMap(
      enclosingExpressionFromPropertyOfExpressionArgument(
        context.program,
        currentLocation,
      ),
      expression =>
        either.match(readFunctionExpression(expression), {
          left: _ => option.none,
          right: option.makeSome,
        }),
    )

    if (option.isSome(enclosingFunction)) {
      const parameterName = getParameterName(enclosingFunction.value)
      if (!parameterTypes.has(parameterName)) {
        const parameterTypeResult = getFunctionParameterType(
          enclosingFunction.value,
          {
            keywordHandlers: context.keywordHandlers,
            program: context.program,
            location: currentLocation.slice(0, -2),
          },
        )

        if (either.isLeft(parameterTypeResult)) {
          throw new Error(
            'Cannot determine parameter type of function. This is a bug!',
            { cause: parameterTypeResult.value },
          )
        }

        // Side-effect: add the parameter.
        parameterTypes.set(parameterName, parameterTypeResult.value)
      }
    }

    currentLocation = currentLocation.slice(0, -1)
  }

  return parameterTypes
}

// TODO: Consider a higher-level externally-visible wrapper which only requires
// `node` and `context`. External call sites currently all look like this:
// `inferType(node, resolveParameterTypes(context), new Set(), context)`
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
      getFunctionParameterType(
        functionExpressionResult.value,
        // TODO: `getFunctionParameterType` expects `context.location` to point
        // at the function, but `context.location` isn't updated when
        // `inferType` recurses, so this context often points somewhere else.
        // Could be fixed by threading the current path through recursive calls.
        context,
      ),
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
 * With no explicit parameter annotation, an attempt is made to infer a type
 * from the context. If that fails, a new type parameter (constrained to the top
 * type) is created for the function parameter.
 *
 * If there is an annotation, it's used to create one or more type parameters
 * with constraints derived from the annotation (see
 * `genericizeFunctionParameterAnnotation` for specifics).
 */
const getFunctionParameterType = (
  expression: FunctionExpression,
  contextOfFunction: ExpressionContext,
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
      const contextualType = option.flatMap(
        enclosingExpressionFromPropertyOfExpressionArgument(
          contextOfFunction.program,
          contextOfFunction.location,
        ),
        (enclosingExpression): Option<Type> => {
          if (
            isKeywordExpressionWithArgument('@runtime', enclosingExpression)
          ) {
            return option.makeSome(types.runtimeContext)
          }

          const applyExpressionResult = readApplyExpression(enclosingExpression)
          if (either.isRight(applyExpressionResult)) {
            const contextOfEnclosingExpression: ExpressionContext = {
              program: contextOfFunction.program,
              keywordHandlers: contextOfFunction.keywordHandlers,
              location: contextOfFunction.location.slice(0, -2),
            }
            const contextuallyAppliedFunctionType = inferType(
              applyExpressionResult.value[1].function,
              resolveParameterTypes(contextOfEnclosingExpression),
              new Set(),
              contextOfEnclosingExpression,
            )

            // If the applied function's signature is `(a ~> b) ~> c`, the
            // function passed to it should have its parameter typed as `a`.
            if (
              either.isRight(contextuallyAppliedFunctionType) &&
              contextuallyAppliedFunctionType.value.kind === 'function' &&
              contextuallyAppliedFunctionType.value.signature.parameter.kind ===
                'function'
            ) {
              return option.makeSome(
                contextuallyAppliedFunctionType.value.signature.parameter
                  .signature.parameter,
              )
            }
          }

          return option.none
        },
      )

      return option.match(contextualType, {
        some: either.makeRight,
        none: _ =>
          either.makeRight(
            genericizeFunctionParameterAnnotation(
              getParameterName(expression),
              types.something,
            ),
          ),
      })
    },
  })

const enclosingExpressionFromPropertyOfExpressionArgument = (
  program: SemanticGraph,
  pathToNode: KeyPath,
): Option<SemanticGraph> => {
  if (pathToNode.length < 2) {
    return option.none
  } else {
    const pathToPossibleExpression = pathToNode.slice(0, -2)
    return option.filter(
      applyKeyPathToSemanticGraph(program, pathToPossibleExpression),
      isExpression,
    )
  }
}
