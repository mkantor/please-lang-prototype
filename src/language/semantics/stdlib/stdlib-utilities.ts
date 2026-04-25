import either, { type Either } from '@matt.kantor/either'
import option from '@matt.kantor/option'
import {
  keyPathToLookupExpression,
  makeApplyExpression,
} from '../../semantics.js'
import {
  makeFunctionNode,
  type FunctionNodeCallError,
  type FunctionNodeCallSignature,
} from '../function-node.js'
import { type NonEmptyKeyPath } from '../key-path.js'
import {
  containsAnyUnelaboratedNodes,
  type SemanticGraph,
} from '../semantic-graph.js'
import { type FunctionType, type Type } from '../type-system/type-formats.js'

const handleUnavailableDependencies =
  (f: FunctionNodeCallSignature) =>
  (argument: SemanticGraph): ReturnType<FunctionNodeCallSignature> => {
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

export const preludeFunctionArity1 = (
  keyPath: NonEmptyKeyPath,
  signature: FunctionType['signature'],
  f: FunctionNodeCallSignature,
) =>
  makeFunctionNode(
    signature,
    () => either.makeRight(keyPathToLookupExpression(keyPath)),
    option.none,
    handleUnavailableDependencies(f),
  )

export const preludeFunctionArity2 = (
  keyPath: NonEmptyKeyPath,
  signature: {
    readonly parameter: Type
    readonly return: FunctionType
  },
  f: (
    argument1: SemanticGraph,
  ) => Either<FunctionNodeCallError, FunctionNodeCallSignature>,
) =>
  preludeFunctionArity1(keyPath, signature, argument1 =>
    either.map(f(argument1), f1 =>
      makeFunctionNode(
        signature.return.signature,
        serializeOnceAppliedFunction(keyPath, argument1),
        option.none,
        handleUnavailableDependencies(f1),
      ),
    ),
  )

export const preludeFunctionArity3 = (
  keyPath: NonEmptyKeyPath,
  signature: {
    readonly parameter: Type
    readonly return: FunctionType & {
      readonly signature: {
        readonly parameter: Type
        readonly return: FunctionType
      }
    }
  },
  f: (
    argument1: SemanticGraph,
  ) => Either<
    FunctionNodeCallError,
    (
      argument2: SemanticGraph,
    ) => Either<FunctionNodeCallError, FunctionNodeCallSignature>
  >,
) =>
  preludeFunctionArity1(keyPath, signature, argument1 =>
    either.map(f(argument1), f1 =>
      makeFunctionNode(
        signature.return.signature,
        serializeOnceAppliedFunction(keyPath, argument1),
        option.none,
        handleUnavailableDependencies(argument2 =>
          either.map(f1(argument2), f2 =>
            makeFunctionNode(
              signature.return.signature.return.signature,
              serializeTwiceAppliedFunction(keyPath, argument1, argument2),
              option.none,
              handleUnavailableDependencies(f2),
            ),
          ),
        ),
      ),
    ),
  )
