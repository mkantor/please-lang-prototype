import either, { type Either } from '@matt.kantor/either'
import option, { type Option } from '@matt.kantor/option'
import type { ElaborationError } from '../../errors.js'
import type { Atom } from '../../parsing.js'
import {
  applyKeyPathToSemanticGraph,
  containsAnyUnelaboratedNodes,
  getParameterName,
  ignoredKey,
  isAssignable,
  isExpression,
  isFunctionNode,
  isObjectNode,
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
  stringifyTypeKeyPathForEndUser,
  supplyTypeArguments,
  typeKeyPathFromObjectNode,
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
      enclosingExpressionFromPropertyOfExpressionArgument({
        program: context.program,
        location: currentLocation,
      }),
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
            mutableInferenceCache: context.mutableInferenceCache,
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

export const inferType = (
  node: SemanticGraph,
  context: ExpressionContext,
): Either<ElaborationError, Type> =>
  inferTypeImplementation(
    node,
    resolveParameterTypes(context),
    new Set(),
    context,
  )

const inferTypeImplementation = (
  node: SemanticGraph,
  parameterTypes: ReadonlyMap<Atom, Type>,
  lookingUpKeys: ReadonlySet<Atom>,
  context: ExpressionContext,
): Either<ElaborationError, Type> => {
  const cacheKey = stringifyTypeKeyPathForEndUser(context.location)
  const cached = context.mutableInferenceCache.get(cacheKey)
  if (cached !== undefined) {
    return either.makeRight(cached)
  }

  const cacheOnSuccess = (
    result: Either<ElaborationError, Type>,
  ): Either<ElaborationError, Type> =>
    either.map(result, type => {
      context.mutableInferenceCache.set(cacheKey, type)
      return type
    })

  /**
   * Build context for a descendant node by appending `subPath` to
   * `context.location`.
   *
   * Warning: Call sites are coupled to specific expression structures and
   * TypeScript won't warn you if things become mis-aligned. Pay special
   * attention whenever an expression shape is revised.
   */
  const descendantContext = (subPath: KeyPath): ExpressionContext => ({
    ...context,
    location: [...context.location, ...subPath],
  })

  if (
    typeof node === 'string' ||
    typeof node === 'symbol' ||
    typeof node === 'function'
  ) {
    return cacheOnSuccess(literalTypeFromSemanticGraph(node))
  }

  // @function: infer parameter type from context (or an explicit annotation)
  // and return type from the body.
  const functionExpressionResult = readFunctionExpression(node)
  if (either.isRight(functionExpressionResult)) {
    return cacheOnSuccess(
      either.flatMap(
        getFunctionParameterType(functionExpressionResult.value, context),
        parameterType =>
          either.map(
            inferTypeImplementation(
              functionExpressionResult.value[1].body,
              new Map([
                ...parameterTypes,
                [
                  getParameterName(functionExpressionResult.value),
                  parameterType,
                ],
              ]),
              lookingUpKeys,
              descendantContext(['1', 'body']),
            ),
            returnType =>
              makeFunctionType('', {
                parameter: parameterType,
                return: returnType,
              }),
          ),
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
      return cacheOnSuccess(either.makeRight(paramType))
    } else if (!lookingUpKeys.has(key)) {
      const lookupResult = lookup({ key, context })
      if (either.isRight(lookupResult) && option.isSome(lookupResult.value)) {
        const { foundValue, foundLocation } = lookupResult.value.value
        const innerResult = inferTypeImplementation(
          foundValue,
          parameterTypes,
          new Set([...lookingUpKeys, key]),
          foundLocation === 'prelude' ?
            {
              ...context,
              // We don't have a way to key the cache for inferences from the
              // prelude. Use a fresh cache so as not to pollute the shared one.
              mutableInferenceCache: new Map(),
            }
          : {
              ...context,
              location: foundLocation,
            },
        )
        return cacheOnSuccess(innerResult)
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
    return cacheOnSuccess(
      either.flatMap(
        inferTypeImplementation(
          indexExpressionResult.value[1].object,
          parameterTypes,
          lookingUpKeys,
          descendantContext(['1', 'object']),
        ),
        objectType =>
          either.map(
            typeKeyPathFromObjectNode(
              indexExpressionResult.value[1].query,
              descendantContext(['1', 'query']),
              (node, context) =>
                inferTypeImplementation(
                  node,
                  parameterTypes,
                  lookingUpKeys,
                  context,
                ),
            ),
            keyPath => applyKeyPathToType(objectType, keyPath),
          ),
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
      return cacheOnSuccess(
        inferTypeImplementation(
          functionExpressionResult.value[1].body,
          new Map([
            ...parameterTypes,
            [
              getParameterName(functionExpressionResult.value),
              types.runtimeContext,
            ],
          ]),
          lookingUpKeys,
          descendantContext(['1', 'function', '1', 'body']),
        ),
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
    const inferredFunctionType = inferTypeImplementation(
      applyExpressionResult.value[1].function,
      parameterTypes,
      lookingUpKeys,
      descendantContext(['1', 'function']),
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
          const argumentTypeResult = inferTypeImplementation(
            applyExpressionResult.value[1].argument,
            parameterTypes,
            lookingUpKeys,
            descendantContext(['1', 'argument']),
          )
          if (either.isRight(argumentTypeResult)) {
            // Supply type arguments to the return type based on the inferred
            // argument type.
            return cacheOnSuccess(
              either.makeRight(
                supplyTypeArguments(
                  returnType,
                  getTypesForTypeParameters({
                    parameterType,
                    argumentType: argumentTypeResult.value,
                  }),
                ),
              ),
            )
          } else {
            return cacheOnSuccess(either.makeRight(returnType))
          }
        },
        none: _ => either.makeRight(types.something),
        // TODO: Error instead once inference is comprehensive enough to do so
        // without failing tests:
        // none: _ =>
        //   either.makeLeft({
        //     kind: 'invalidExpression',
        //     message: `cannot infer return type: only functions can be applied, but got a \`${stringifyTypeForEndUser(inferredFunctionType.value)}\``,
        //   }),
      })
    }
  }

  // @if: narrow to the chosen branch when the condition is statically known
  // to be `true` or `false`; otherwise return a union of the branch types.
  const ifExpressionResult = readIfExpression(node)
  if (either.isRight(ifExpressionResult)) {
    const { condition, then, else: otherwise } = ifExpressionResult.value[1]

    const inferThen = () =>
      inferTypeImplementation(
        then,
        parameterTypes,
        lookingUpKeys,
        descendantContext(['1', 'then']),
      )
    const inferElse = () =>
      inferTypeImplementation(
        otherwise,
        parameterTypes,
        lookingUpKeys,
        descendantContext(['1', 'else']),
      )

    return cacheOnSuccess(
      either.flatMap(
        inferTypeImplementation(
          condition,
          parameterTypes,
          lookingUpKeys,
          descendantContext(['1', 'condition']),
        ),
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
      ),
    )
  }

  // @panic: infer the bottom type.
  const panicExpressionResult = readPanicExpression(node)
  if (either.isRight(panicExpressionResult)) {
    return cacheOnSuccess(either.makeRight(types.nothing))
  }

  if (isObjectNode(node) && containsAnyUnelaboratedNodes(node)) {
    // Infer unelaborated descendants' types.
    return cacheOnSuccess(
      either.map(
        either.sequence(
          Object.entries(node).map(([key, value]) =>
            either.map(
              inferTypeImplementation(
                value,
                parameterTypes,
                lookingUpKeys,
                descendantContext([key]),
              ),
              childType => [key, childType] as const,
            ),
          ),
        ),
        entries => makeObjectType('', Object.fromEntries(entries)),
      ),
    )
  } else {
    return cacheOnSuccess(literalTypeFromSemanticGraph(node))
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
): Either<ElaborationError, Type> =>
  option.match(getParameterTypeAnnotation(expression), {
    some: annotation =>
      either.map(
        // Type annotation lookups happen from the function's scope rather than
        // their own location (a property within the `@function`).
        // TODO: Consider separating out the cache key prefix from the
        // `context.location` somehow so that I can say "lookups start from X,
        // cache key paths are rooted at Y".
        inferType(annotation, {
          ...contextOfFunction,
          mutableInferenceCache: new Map(),
        }),
        annotationType => {
          const parameterName = getParameterName(expression)
          // `_` (`ignoredKey`) is the name for an ignored parameter (and is what
          // the parser emits for `~>` syntax sugar). Genericization is skipped
          // in this case so `a ~> b` and `(_: a) => b` can be used to describe
          // concrete function types rather than generic ones.
          return parameterName === ignoredKey ? annotationType : (
              genericizeFunctionParameterAnnotation(
                parameterName,
                annotationType,
              )
            )
        },
      ),
    none: _ => {
      const contextualType = option.flatMap(
        enclosingExpressionFromPropertyOfExpressionArgument(contextOfFunction),
        (enclosingExpression): Option<Type> => {
          if (
            isKeywordExpressionWithArgument('@runtime', enclosingExpression)
          ) {
            return option.makeSome(types.runtimeContext)
          }

          const positionInEnclosingExpression =
            contextOfFunction.location[contextOfFunction.location.length - 1]
          const applyExpressionResult = readApplyExpression(enclosingExpression)
          if (
            either.isRight(applyExpressionResult) &&
            positionInEnclosingExpression === 'argument'
          ) {
            const contextOfEnclosingExpression: ExpressionContext = {
              program: contextOfFunction.program,
              keywordHandlers: contextOfFunction.keywordHandlers,
              location: contextOfFunction.location.slice(0, -2),
              mutableInferenceCache: contextOfFunction.mutableInferenceCache,
            }
            const contextuallyAppliedFunctionType = inferType(
              applyExpressionResult.value[1].function,
              {
                ...contextOfEnclosingExpression,
                location: [
                  ...contextOfEnclosingExpression.location,
                  '1',
                  'function',
                ],
              },
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

const enclosingExpressionFromPropertyOfExpressionArgument = ({
  program,
  location,
}: {
  readonly program: SemanticGraph
  readonly location: KeyPath
}): Option<SemanticGraph> => {
  if (location.length < 2) {
    return option.none
  } else {
    const pathToPossibleExpression = location.slice(0, -2)
    return option.filter(
      applyKeyPathToSemanticGraph(program, pathToPossibleExpression),
      isExpression,
    )
  }
}
