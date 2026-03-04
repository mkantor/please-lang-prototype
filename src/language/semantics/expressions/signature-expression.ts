import either, { type Either } from '@matt.kantor/either'
import type { ElaborationError } from '../../errors.js'
import { isKeywordExpressionWithArgument } from '../expression.js'
import { makeObjectNode, type ObjectNode } from '../object-node.js'
import type { SemanticGraph } from '../semantic-graph.js'
import { readArgumentsFromExpression } from './expression-utilities.js'

export type SignatureExpression = ObjectNode & {
  readonly 0: '@signature'
  readonly 1: {
    readonly parameter: SemanticGraph
    readonly return: SemanticGraph
  }
}

export const readSignatureExpression = (
  node: SemanticGraph,
): Either<ElaborationError, SignatureExpression> =>
  isKeywordExpressionWithArgument('@signature', node) ?
    either.map(
      readArgumentsFromExpression(node, ['parameter', 'return']),
      ([p, r]) => makeSignatureExpression({ parameter: p, return: r }),
    )
  : either.makeLeft({
      kind: 'invalidExpression',
      message: 'not a `@signature` expression',
    })

export const makeSignatureExpression = (signature: {
  readonly parameter: SemanticGraph
  readonly return: SemanticGraph
}): SignatureExpression =>
  makeObjectNode({
    0: '@signature',
    1: makeObjectNode({
      parameter: signature.parameter,
      return: signature.return,
    }),
  })
