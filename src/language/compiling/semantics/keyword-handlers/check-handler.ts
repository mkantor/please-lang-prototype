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
  readIfExpression,
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
  makeFunctionType,
  makeObjectType,
  makeUnionType,
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

            // Side-effect: add the parameter.
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
  lookingUpKeys: ReadonlySet<Atom>,
  context: ExpressionContext,
): Either<ElaborationError, Type> => {
  // @function: infer return type from the body.
  const functionExpressionResult =
    isFunctionNode(node) ?
      either.flatMap(node.serialize(), readFunctionExpression)
    : readFunctionExpression(node)
  if (either.isRight(functionExpressionResult)) {
    const { parameter, body } = functionExpressionResult.value[1]

    // TODO: Implement syntax for explicit parameter type annotations, as well
    // as eventually supporting contextual inference of un-annotated parameters.
    const parameterType = types.something

    return either.map(
      inferType(
        body,
        new Map([...parameterTypes, [parameter, parameterType]]),
        lookingUpKeys,
        context,
      ),
      returnType =>
        makeFunctionType('', { parameter: parameterType, return: returnType }),
    )
  }

  // TODO: Once the @function handler uses real type signatures, move this
  // before the @function case above.
  if (
    typeof node === 'string' ||
    typeof node === 'symbol' ||
    typeof node === 'function'
  ) {
    return literalTypeFromSemanticGraph(node)
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
          [functionExpressionResult.value[1].parameter, types.runtimeContext],
        ]),
        lookingUpKeys,
        context,
      )
    }
    return either.makeRight(types.something)
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
      if (inferredFunctionType.value.kind === 'function') {
        return either.makeRight(inferredFunctionType.value.signature.return)
      } else if (inferredFunctionType.value.kind === 'parameter') {
        // Let's just assume this type parameter will be instantiated with a
        // function type. Ideally this would actually be checked elsewhere.
        // TODO: If there's not an appropriate place to do such a check, could
        // check here that the constraint is a function type.
        return either.makeRight(
          inferredFunctionType.value.constraint.assignableTo,
        )
      } else {
        return either.makeLeft({
          kind: 'invalidExpression',
          message: 'cannot infer type: only functions can be applied',
        })
      }
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
