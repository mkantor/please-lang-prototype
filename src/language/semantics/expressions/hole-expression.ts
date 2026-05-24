import either, { type Either } from '@matt.kantor/either'
import type { ElaborationError } from '../../errors.js'
import type { Atom } from '../../parsing.js'
import { isKeywordExpressionWithArgument } from '../expression.js'
import { isFunctionNode } from '../function-node.js'
import {
  isObjectNode,
  makeObjectNode,
  type ObjectNode,
} from '../object-node.js'
import type { SemanticGraph } from '../semantic-graph.js'
import { literalTypeFromSemanticGraph } from '../type-system.js'
import type { TypeParameter } from '../type-system/type-formats.js'
import {
  isTypeParameter,
  makeTypeParameter,
} from '../type-system/type-formats.js'
import { readArgumentsFromExpression } from './expression-utilities.js'

export type HoleExpression = ObjectNode & {
  readonly 0: '@hole'
  readonly 1: ObjectNode & {
    readonly name: Atom
    readonly constraint: ObjectNode & {
      readonly assignableTo: SemanticGraph
    }
  }

  // This is stashed on the node so that repeated reads (e.g. successive
  // type-inference passes) return a parameter with stable identity.
  readonly [typeParameterKey]: TypeParameter
}
const typeParameterKey = Symbol('typeParameter')

/**
 * Mints a new type parameter for the node if one doesn't already exist.
 */
export const readHoleExpression = (
  node: SemanticGraph,
): Either<ElaborationError, HoleExpression> =>
  isKeywordExpressionWithArgument('@hole', node) ?
    either.flatMap(
      readArgumentsFromExpression(node, ['name', 'constraint']),
      ([name, constraint]) => {
        if (typeof name !== 'string') {
          return either.makeLeft<ElaborationError>({
            kind: 'invalidExpression',
            message: '`@hole` name must be an atom',
          })
        } else if (!isObjectNode(constraint)) {
          return either.makeLeft({
            kind: 'invalidExpression',
            message: '`@hole` constraint must be an object',
          })
        } else if (
          typeParameterKey in node &&
          (typeof node[typeParameterKey] !== 'object' ||
            typeof node[typeParameterKey] === null)
        ) {
          return either.makeLeft({
            kind: 'bug',
            message:
              '`@hole` had an existing type parameter that was not actually a type parameter',
          })
        } else {
          const assignableToNode = constraint['assignableTo']
          if (assignableToNode === undefined) {
            return either.makeLeft({
              kind: 'invalidExpression',
              message:
                '`@hole` constraint must contain an `assignableTo` property',
            })
          } else {
            const typeParameter =
              (
                typeParameterKey in node &&
                isTypeParameter(node[typeParameterKey])
              ) ?
                node[typeParameterKey]
              : undefined
            return either.map(
              literalTypeFromSemanticGraph(assignableToNode),
              assignableTo => {
                const node = makeObjectNode({
                  0: '@hole',
                  1: makeObjectNode({
                    name,
                    constraint: makeObjectNode({
                      assignableTo: assignableToNode,
                    }),
                  }),
                })
                return Object.assign(node, {
                  [typeParameterKey]:
                    typeParameter === undefined ?
                      makeTypeParameter(name, { assignableTo })
                    : typeParameter,
                })
              },
            )
          }
        }
      },
    )
  : either.makeLeft({
      kind: 'invalidExpression',
      message: 'not a `@hole` expression',
    })

export const makeHoleExpression = (
  name: Atom,
  constraint: HoleExpression[1]['constraint'],
  parameter: TypeParameter,
): HoleExpression =>
  Object.assign(
    makeObjectNode({
      0: '@hole',
      1: makeObjectNode({ name, constraint }),
    }),
    { [typeParameterKey]: parameter },
  )

export const getHoleTypeParameter = (node: HoleExpression): TypeParameter =>
  node[typeParameterKey]

/**
 * Walk an annotation, returning a `Map` from hole names to their expressions.
 */
export const collectHolesByName = (
  annotation: SemanticGraph,
): ReadonlyMap<Atom, HoleExpression> => {
  const collect = (
    accumulator: Map<Atom, HoleExpression>,
    node: SemanticGraph,
  ): Map<Atom, HoleExpression> => {
    const holeExpressionResult = readHoleExpression(node)
    if (
      either.isRight(holeExpressionResult) &&
      typeParameterKey in holeExpressionResult.value
    ) {
      const node = holeExpressionResult.value
      const name = node[1]['name']
      if (!accumulator.has(name)) {
        // Side effect: remember the hole.
        accumulator.set(name, node)
      }
      return accumulator
    } else if (isFunctionNode(node)) {
      return either.match(node.serialize(), {
        right: serialized => collect(accumulator, serialized),
        left: _ => accumulator,
      })
    } else if (!isObjectNode(node)) {
      return accumulator
    } else {
      return Object.values(node).reduce(collect, accumulator)
    }
  }
  return collect(new Map(), annotation)
}
