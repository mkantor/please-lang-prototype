import either, { type Either } from '@matt.kantor/either'
import option from '@matt.kantor/option'
import type { DependencyUnavailable, Panic } from '../../errors.js'
import {
  keyPathToLookupExpression,
  makeApplyExpression,
} from '../../semantics.js'
import { makeFunctionNode } from '../function-node.js'
import { type NonEmptyKeyPath } from '../key-path.js'
import {
  containsAnyUnelaboratedNodes,
  type SemanticGraph,
} from '../semantic-graph.js'
import { type FunctionType } from '../type-system/type-formats.js'

const handleUnavailableDependencies =
  (
    f: (
      argument: SemanticGraph,
    ) => Either<DependencyUnavailable | Panic, SemanticGraph>,
  ) =>
  (
    argument: SemanticGraph,
  ): Either<DependencyUnavailable | Panic, SemanticGraph> => {
    if (containsAnyUnelaboratedNodes(argument)) {
      return either.makeLeft({
        kind: 'dependencyUnavailable',
        message: 'one or more dependencies are unavailable',
      })
    } else {
      return f(argument)
    }
  }

export const serializeOnceAppliedFunction =
  (keyPath: NonEmptyKeyPath, argument: SemanticGraph) => () =>
    either.makeRight(
      makeApplyExpression({
        function: keyPathToLookupExpression(keyPath),
        argument,
      }),
    )

export const serializeTwiceAppliedFunction =
  (
    keyPath: NonEmptyKeyPath,
    argument1: SemanticGraph,
    argument2: SemanticGraph,
  ) =>
  () =>
    either.makeRight(
      makeApplyExpression({
        function: serializeOnceAppliedFunction(keyPath, argument1)().value,
        argument: argument2,
      }),
    )

export const preludeFunction = (
  keyPath: NonEmptyKeyPath,
  signature: FunctionType['signature'],
  f: (
    value: SemanticGraph,
  ) => Either<DependencyUnavailable | Panic, SemanticGraph>,
) =>
  makeFunctionNode(
    signature,
    () => either.makeRight(keyPathToLookupExpression(keyPath)),
    option.none,
    handleUnavailableDependencies(f),
  )
