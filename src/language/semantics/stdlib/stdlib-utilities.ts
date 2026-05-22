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
import {
  getTypesForTypeParameters,
  literalTypeFromSemanticGraph,
  supplyTypeArguments,
} from '../type-system/type-utilities.js'

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
    either.flatMap(
      refineReturnedFunctionType(
        signature.parameter,
        signature.return,
        argument1,
      ),
      refinedReturn =>
        either.map(f(argument1), f1 =>
          makeFunctionNode(
            refinedReturn.signature,
            serializeOnceAppliedFunction(keyPath, argument1),
            option.none,
            handleUnavailableDependencies(f1),
          ),
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
    either.flatMap(
      refineReturnedFunctionType(
        signature.parameter,
        signature.return,
        argument1,
      ),
      refinedReturn1 =>
        either.map(f(argument1), f1 =>
          makeFunctionNode(
            refinedReturn1.signature,
            serializeOnceAppliedFunction(keyPath, argument1),
            option.none,
            handleUnavailableDependencies(argument2 =>
              either.flatMap(
                refinedReturn1.signature.return.kind === 'function' ?
                  refineReturnedFunctionType(
                    refinedReturn1.signature.parameter,
                    refinedReturn1.signature.return,
                    argument2,
                  )
                : either.makeLeft({
                    kind: 'bug',
                    message: `supplying type arguments in an arity-3 standard library function somehow transformed its first return type into a ${refinedReturn1.signature.return.kind} type (it should be a function type)`,
                  }),
                refinedReturn2 =>
                  either.map(f1(argument2), f2 =>
                    makeFunctionNode(
                      refinedReturn2.signature,
                      serializeTwiceAppliedFunction(
                        keyPath,
                        argument1,
                        argument2,
                      ),
                      option.none,
                      handleUnavailableDependencies(f2),
                    ),
                  ),
              ),
            ),
          ),
        ),
    ),
  )

/**
 * Substitute type parameters using an argument's type into the returned
 * function type of a higher-order function. Without this, each partial
 * application would carry the outermost static signature, leaving type
 * parameters uninstantiated.
 */
const refineReturnedFunctionType = (
  parameterType: Type,
  returnedType: FunctionType,
  argument: SemanticGraph,
): Either<FunctionNodeCallError, FunctionType> =>
  either.flatMap(literalTypeFromSemanticGraph(argument), argumentType => {
    const refinedReturnType = supplyTypeArguments(
      returnedType,
      getTypesForTypeParameters({
        parameterType,
        argumentType,
      }),
    )
    return refinedReturnType.kind === 'function' ?
        either.makeRight(refinedReturnType)
      : either.makeLeft({
          kind: 'bug',
          message: `supplying type arguments to a standard library function somehow transformed it into a ${refinedReturnType.kind} type`,
        })
  })
