import { either, option, type Either } from '../../adts.js'
import { withPhantomData, type WithPhantomData } from '../../phantom-data.js'
import type { Writable } from '../../utility-types.js'
import type { ElaborationError, InvalidSyntaxTreeError } from '../errors.js'
import type { Atom, Molecule, SyntaxTree } from '../parsing.js'
import { makeObjectNode, type KeyPath, type ObjectNode } from '../semantics.js'
import {
  extractStringValueIfPossible,
  updateValueAtKeyPathInSemanticGraph,
  type SemanticGraph,
} from './semantic-graph.js'

declare const _elaborated: unique symbol
type Elaborated = { readonly [_elaborated]: true }
export type ElaboratedSemanticGraph = WithPhantomData<SemanticGraph, Elaborated>

export type ExpressionContext = {
  readonly program: SemanticGraph
  readonly location: KeyPath
}

export type KeywordElaborationResult = Either<ElaborationError, SemanticGraph>

export type KeywordHandler = (
  expression: ObjectNode,
  context: ExpressionContext,
) => KeywordElaborationResult

export type KeywordModule<Keyword extends `@${string}`> = {
  readonly isKeyword: (input: string) => input is Keyword
  readonly handlers: Readonly<Record<Keyword, KeywordHandler>>
}

export const elaborate = (
  program: SyntaxTree,
  keywordModule: KeywordModule<`@${string}`>,
): Either<ElaborationError, ElaboratedSemanticGraph> =>
  elaborateWithContext(program, keywordModule, {
    location: [],
    program: typeof program === 'string' ? program : makeObjectNode(program),
  })

export const elaborateWithContext = (
  program: SyntaxTree,
  keywordModule: KeywordModule<`@${string}`>,
  context: ExpressionContext,
): Either<ElaborationError, ElaboratedSemanticGraph> =>
  either.map(
    typeof program === 'string'
      ? handleAtomWhichMayNotBeAKeyword(program)
      : elaborateWithinMolecule(program, keywordModule, context),
    withPhantomData<Elaborated>(),
  )

const elaborateWithinMolecule = (
  molecule: Molecule,
  keywordModule: KeywordModule<`@${string}`>,
  context: ExpressionContext,
): Either<ElaborationError, SemanticGraph> => {
  const possibleExpressionAsObjectNode: Writable<ObjectNode> = makeObjectNode(
    {},
  )
  let updatedProgram = context.program

  for (let [key, value] of Object.entries(molecule)) {
    const keyUpdateResult = handleAtomWhichMayNotBeAKeyword(key)
    if (either.isLeft(keyUpdateResult)) {
      // Immediately bail on error.
      return keyUpdateResult
    } else {
      const updatedKey = keyUpdateResult.value
      if (typeof value === 'string') {
        possibleExpressionAsObjectNode[updatedKey] = value
      } else {
        const elaborationResult = elaborateWithinMolecule(
          value,
          keywordModule,
          {
            location: [...context.location, key],
            program: updatedProgram,
          },
        )
        if (either.isLeft(elaborationResult)) {
          // Immediately bail on error.
          return elaborationResult
        }

        const programUpdateResult = updateValueAtKeyPathInSemanticGraph(
          updatedProgram,
          [...context.location, key],
          _ => elaborationResult.value,
        )
        if (either.isLeft(programUpdateResult)) {
          // Immediately bail on error.
          return elaborationResult
        }
        updatedProgram = programUpdateResult.value
        possibleExpressionAsObjectNode[updatedKey] = elaborationResult.value
      }
    }
  }

  const { 0: possibleKeywordAsNode, ...propertiesInNeedOfFinalizationAsNodes } =
    possibleExpressionAsObjectNode

  // At this point `possibleExpressionAsObjectNode` may still have raw escape sequences at the top
  // level (whether it is an expression or not).
  for (let [key, value] of Object.entries(
    propertiesInNeedOfFinalizationAsNodes,
  )) {
    const cannotBeKeyword = extractStringValueIfPossible(value)
    if (!option.isNone(cannotBeKeyword)) {
      const valueUpdateResult = handleAtomWhichMayNotBeAKeyword(
        cannotBeKeyword.value,
      )
      if (either.isLeft(valueUpdateResult)) {
        // Immediately bail on error.
        return valueUpdateResult
      } else {
        const updatedValue = valueUpdateResult.value
        possibleExpressionAsObjectNode[key] = updatedValue
      }
    }
  }

  const possibleKeyword = possibleExpressionAsObjectNode['0']
  if (possibleKeyword === undefined) {
    // The input didn't have a `0` property, so it's not an expression.
    return either.makeRight(possibleExpressionAsObjectNode)
  } else {
    return option.match(extractStringValueIfPossible(possibleKeyword), {
      none: () => {
        // The `0` property was not a string, so it's not an expression.
        return either.makeRight(possibleExpressionAsObjectNode)
      },
      some: possibleKeywordAsString =>
        handleObjectNodeWhichMayBeAExpression(
          {
            ...possibleExpressionAsObjectNode,
            0: possibleKeywordAsString,
          },
          keywordModule,
          {
            program: updatedProgram,
            location: context.location,
          },
        ),
    })
  }
}

const handleObjectNodeWhichMayBeAExpression = <Keyword extends `@${string}`>(
  node: ObjectNode & { readonly 0: Atom },
  keywordModule: KeywordModule<Keyword>,
  context: ExpressionContext,
): Either<ElaborationError, SemanticGraph> => {
  const { 0: possibleKeyword, ...possibleArguments } = node
  return option.match(
    option.fromPredicate(possibleKeyword, keywordModule.isKeyword),
    {
      none: () =>
        /^@[^@]/.test(possibleKeyword)
          ? either.makeLeft({
              kind: 'unknownKeyword',
              message: `unknown keyword: \`${possibleKeyword}\``,
            })
          : either.makeRight({
              ...node,
              0: unescapeKeywordSigil(possibleKeyword),
            }),
      some: keyword =>
        keywordModule.handlers[keyword](
          makeObjectNode(possibleArguments),
          context,
        ),
    },
  )
}

const handleAtomWhichMayNotBeAKeyword = (
  atom: Atom,
): Either<InvalidSyntaxTreeError, Atom> => {
  if (/^@[^@]/.test(atom)) {
    return either.makeLeft({
      kind: 'invalidSyntaxTree',
      message: `keywords cannot be used here: ${atom}`,
    })
  } else {
    return either.makeRight(unescapeKeywordSigil(atom))
  }
}

const unescapeKeywordSigil = (value: string) =>
  /^@@/.test(value) ? value.substring(1) : value
