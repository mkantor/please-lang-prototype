import { either, option, type Either, type Option } from '../../../adts.js'
import type { ElaborationError } from '../../errors.js'
import type { Atom, Molecule } from '../../parsing.js'
import type { ExpressionContext } from '../expression-elaboration.js'
import type { Expression } from '../expression.js'
import { stringifyKeyPathForEndUser } from '../key-path.js'
import {
  lookupPropertyOfObjectNode,
  makeUnelaboratedObjectNode,
  type ObjectNode,
} from '../object-node.js'
import {
  applyKeyPathToSemanticGraph,
  isSemanticGraph,
  type SemanticGraph,
} from '../semantic-graph.js'

export const asSemanticGraph = (
  value: SemanticGraph | Molecule,
): SemanticGraph =>
  isSemanticGraph(value) ? value : makeUnelaboratedObjectNode(value)

export const locateSelf = (context: ExpressionContext) =>
  option.match(applyKeyPathToSemanticGraph(context.program, context.location), {
    none: () =>
      either.makeLeft({
        kind: 'bug',
        message: `failed to locate self at \`${stringifyKeyPathForEndUser(
          context.location,
        )}\` in program`,
      }),
    some: either.makeRight,
  })

export const readArgumentsFromExpression = <
  const Specification extends readonly (readonly [
    string,
    ...(readonly string[]),
  ])[],
>(
  expression: Expression,
  specification: Specification,
): Either<ElaborationError, ParsedExpressionArguments<Specification>> => {
  const expressionArguments: ObjectNode[string][] = []
  for (const aliases of specification) {
    const argument = lookupWithinExpression(aliases, expression)
    if (option.isNone(argument)) {
      const requiredKeySummary = aliases
        .map(alias => `\`${alias}\``)
        .join(' or ')
      return either.makeLeft({
        kind: 'invalidExpression',
        message: `missing required property ${requiredKeySummary}`,
      })
    } else {
      expressionArguments.push(argument.value)
    }
  }
  return either.makeRight(
    // This is correct since the above loop pushes one argument for each `specification` element.
    expressionArguments as ParsedExpressionArguments<Specification>,
  )
}
type ParsedExpressionArguments<
  Specification extends readonly (readonly [string, ...(readonly string[])])[],
> = {
  [Index in keyof Specification]: ObjectNode[string]
}

const lookupWithinExpression = (
  keyAliases: readonly [Atom, ...(readonly Atom[])],
  expression: Expression,
): Option<SemanticGraph> => {
  for (const key of keyAliases) {
    const result = lookupPropertyOfObjectNode(key, expression)
    if (!option.isNone(result)) {
      return result
    }
  }
  return option.none
}
