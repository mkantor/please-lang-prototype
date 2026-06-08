import either, { type Either } from '@matt.kantor/either'
import type { Bug } from '../../errors.js'
import { isKeywordExpressionWithArgument } from '../expression.js'
import {
  getHoleTypeParameter,
  readHoleExpression,
} from '../expressions/hole-expression.js'
import type { SemanticGraph } from '../semantic-graph.js'
import { typesBySymbol } from './prelude-types.js'
import { makeObjectType, makeUnionType, type Type } from './type-formats.js'

export const literalTypeFromSemanticGraph = (
  node: SemanticGraph,
): Either<Bug, Type> => {
  if (typeof node === 'string') {
    return either.makeRight({
      kind: 'union',
      members: new Set([node]),
    })
  } else if (typeof node === 'symbol') {
    if (node in typesBySymbol) {
      return either.makeRight(typesBySymbol[node])
    } else {
      return either.makeLeft({
        kind: 'bug',
        message: 'semantic graph contained an unknown symbol',
      })
    }
  } else if (typeof node === 'function') {
    return either.makeRight({
      kind: 'function',
      signature: node.signature,
    })
  } else {
    // TODO: It would be nice to use `readUnionExpression` here, but directly
    // importing values from the *-expression.ts modules causes a dependency
    // cycle. This needs investigation.
    if (isKeywordExpressionWithArgument('@union', node)) {
      return either.map(
        either.sequence(
          Object.values(node[1]).map(literalTypeFromSemanticGraph),
        ),
        memberTypes =>
          makeUnionType(
            memberTypes.flatMap(memberType =>
              memberType.kind === 'union' ?
                [...memberType.members]
              : [memberType],
            ),
          ),
      )
    } else if (isKeywordExpressionWithArgument('@hole', node)) {
      return either.mapLeft(
        either.map(readHoleExpression(node), getHoleTypeParameter),
        error => ({
          kind: 'bug',
          message: '`@hole` expression was invalid',
          cause: error,
        }),
      )
    } else {
      // `node` is an object type.
      return either.map(
        either.sequence(
          Object.entries(node).map(([key, value]) =>
            either.map(literalTypeFromSemanticGraph(value), childType => [
              key,
              childType,
            ]),
          ),
        ),
        entries => makeObjectType(Object.fromEntries(entries)),
      )
    }
  }
}
