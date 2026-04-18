import either, { type Either } from '@matt.kantor/either'
import option from '@matt.kantor/option'
import type { ElaborationError } from '../../../errors.js'
import type { Atom } from '../../../parsing.js'
import {
  applyKeyPathToSemanticGraph,
  containsAnyUnelaboratedNodes,
  isAssignable,
  isExpression,
  isFunctionNode,
  isObjectNode,
  keyPathFromObjectNodeOrMolecule,
  readApplyExpression,
  readCheckExpression,
  readFunctionExpression,
  readIndexExpression,
  readLookupExpression,
  readRuntimeExpression,
  stringifySemanticGraphForEndUser,
  types,
  type Expression,
  type ExpressionContext,
  type KeyPath,
  type KeywordHandler,
  type SemanticGraph,
} from '../../../semantics.js'
import { isKeywordExpressionWithArgument } from '../../../semantics/expression.js'
import {
  applyKeyPathToType,
  literalTypeFromSemanticGraph,
} from '../../../semantics/type-system.js'
import { showType } from '../../../semantics/type-system/show-type.js'
import {
  makeObjectType,
  type Type,
} from '../../../semantics/type-system/type-formats.js'
import { lookup } from './lookup-handler.js'

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

const resolveParameterTypes = (
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
          const parameterName = functionResult.value[1].parameter
          if (!parameterTypes.has(parameterName)) {
            const parameterType =
              (
                isEnclosedInRuntimeExpression(
                  context.program,
                  pathToParentScope,
                )
              ) ?
                types.runtimeContext
              : types.something
            parameterTypes.set(parameterName, parameterType)
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

const inferReturnType = (
  f: SemanticGraph,
  parameterTypes: ReadonlyMap<Atom, Type>,
  lookingUpKeys: ReadonlySet<Atom>,
  context: ExpressionContext,
): Either<ElaborationError, Type> => {
  if (isFunctionNode(f)) {
    return either.makeRight(f.signature.return)
  }

  const functionExpressionResult = readFunctionExpression(f)
  if (either.isRight(functionExpressionResult)) {
    const { parameter, body } = functionExpressionResult.value[1]
    const updatedParameterTypes = new Map([
      ...parameterTypes,
      [parameter, types.something],
    ])
    return inferType(body, updatedParameterTypes, lookingUpKeys, context)
  }

  // Resolve `@lookup`s and recurse so indirectly-referenced functions (e.g.
  // `{ a: _ => 42, b: :a, :b(_) /* <- this */ }`) can be resolved.
  const lookupResult = readLookupExpression(f)
  if (either.isRight(lookupResult)) {
    const key = lookupResult.value[1].key
    if (!lookingUpKeys.has(key)) {
      const lookupResult = lookup({ key, context })
      if (either.isRight(lookupResult) && option.isSome(lookupResult.value)) {
        return inferReturnType(
          lookupResult.value.value,
          parameterTypes,
          new Set([...lookingUpKeys, key]),
          context,
        )
      }
    }
  }

  // Fall back to the top type.
  return either.makeRight(types.something)
}

const inferType = (
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

  // @lookup: check if it directly refers to a function parameter. If so, use
  // the parameter's type. Otherwise, resolve the @lookup, then recur.
  const lookupResult = readLookupExpression(node)
  if (either.isRight(lookupResult)) {
    const key = lookupResult.value[1].key
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
  const indexResult = readIndexExpression(node)
  if (either.isRight(indexResult)) {
    return either.flatMap(
      inferType(
        indexResult.value[1].object,
        parameterTypes,
        lookingUpKeys,
        context,
      ),
      objectType =>
        either.map(
          keyPathFromObjectNodeOrMolecule(indexResult.value[1].query),
          keyPath => applyKeyPathToType(objectType, keyPath),
        ),
    )
  }

  // @runtime: infer return type of the contained function.
  const runtimeResult = readRuntimeExpression(node)
  if (either.isRight(runtimeResult)) {
    const runtimeFunction = runtimeResult.value[1].function
    const functionExpressionResult =
      isFunctionNode(runtimeFunction) ?
        either.flatMap(runtimeFunction.serialize(), readFunctionExpression)
      : readFunctionExpression(runtimeFunction)
    if (either.isRight(functionExpressionResult)) {
      const updatedParameterTypes = new Map(parameterTypes)
      updatedParameterTypes.set(
        functionExpressionResult.value[1].parameter,
        types.runtimeContext,
      )
      return inferType(
        functionExpressionResult.value[1].body,
        updatedParameterTypes,
        lookingUpKeys,
        context,
      )
    }
    return either.makeRight(types.something)
  }

  // @apply: infer the return type from the function being applied.
  const applyResult = readApplyExpression(node)
  if (either.isRight(applyResult)) {
    return inferReturnType(
      applyResult.value[1].function,
      parameterTypes,
      lookingUpKeys,
      context,
    )

    // TODO: Once type inference is implemented for `@function` expressions, do
    // this instead:
    // ```
    // const inferredFunctionType = inferType(
    //   applyExpressionResult.value[1].function,
    //   parameterTypes,
    //   lookingUpKeys,
    //   context,
    // )
    // if (either.isRight(inferredFunctionType)) {
    //   if (inferredFunctionType.value.kind === 'function') {
    //     return either.makeRight(inferredFunctionType.value.signature.return)
    //   } else {
    //     // TODO: Return an error? Non-function types can't be applied.
    //   }
    // }
    // ```
  }

  // TODO: Handle `@if`s and/or other keyword expressions specially?

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

const check = ({
  value,
  type,
  context,
}: {
  readonly value: SemanticGraph
  readonly type: SemanticGraph
  readonly context: ExpressionContext
}): Either<ElaborationError, SemanticGraph> =>
  either.flatMap(
    inferType(value, resolveParameterTypes(context), new Set(), context),
    valueAsType =>
      either.flatMap(literalTypeFromSemanticGraph(type), typeAsType => {
        if (
          isAssignable({
            source: valueAsType,
            target: typeAsType,
          })
        ) {
          return either.makeRight(value)
        } else {
          return either.makeLeft({
            kind: 'typeMismatch',
            message: `the value \`${stringifySemanticGraphForEndUser(
              value,
            )}\` is not assignable to the type \`${showType(typeAsType)}\``,
          })
        }
      }),
  )

export const checkKeywordHandler: KeywordHandler = (
  expression: Expression,
  context: ExpressionContext,
): Either<ElaborationError, SemanticGraph> =>
  either.flatMap(readCheckExpression(expression), ({ 1: { value, type } }) =>
    check({ value, type, context }),
  )
