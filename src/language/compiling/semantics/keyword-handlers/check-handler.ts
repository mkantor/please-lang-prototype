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

const inferType = (
  node: SemanticGraph,
  parameterTypes: ReadonlyMap<Atom, Type>,
): Either<ElaborationError, Type> => {
  if (
    typeof node === 'string' ||
    typeof node === 'symbol' ||
    typeof node === 'function'
  ) {
    return literalTypeFromSemanticGraph(node)
  }

  // @lookup: check if it refers to a parameter, if so resolve type.
  const lookupResult = readLookupExpression(node)
  if (either.isRight(lookupResult)) {
    const key = lookupResult.value[1].key
    const type = parameterTypes.get(key) ?? types.something // TODO: Be more specific in non-parameter cases?
    return either.makeRight(type)
  }

  // @index: infer object type, look up appropriate type by key path.
  const indexResult = readIndexExpression(node)
  if (either.isRight(indexResult)) {
    return either.flatMap(
      inferType(indexResult.value[1].object, parameterTypes),
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
      )
    }
    return either.makeRight(types.something)
  }

  // TODO: Handle `@if`s and/or other keyword expressions specially?

  if (isObjectNode(node) && containsAnyUnelaboratedNodes(node)) {
    // Infer unelaborated descendants' types.
    const children: Record<string, Type> = {}
    for (const [key, value] of Object.entries(node)) {
      const childTypeResult = inferType(value, parameterTypes)
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
    inferType(value, resolveParameterTypes(context)),
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
