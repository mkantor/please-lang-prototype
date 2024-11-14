import { either, option, type Either } from '../../adts.js'
import { withPhantomData, type WithPhantomData } from '../../phantom-data.js'
import type { Writable } from '../../utility-types.js'
import type { ElaborationError, InvalidSyntaxTreeError } from '../errors.js'
import type { Atom, Molecule, SyntaxTree } from '../parsing.js'
import {
  isAtomNode,
  literalValueToSemanticGraph,
  makeAtomNode,
  makeObjectNode,
  type AtomNode,
  type KeyPath,
  type ObjectNode,
  type SemanticGraph,
} from '../semantics.js'

declare const _elaborated: unique symbol
type Elaborated = { readonly [_elaborated]: true }
export type ElaboratedValue = WithPhantomData<SemanticGraph, Elaborated>

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
): Either<ElaborationError, ElaboratedValue> =>
  either.map(
    typeof program === 'string'
      ? handleAtomWhichMayNotBeAKeyword(program)
      : elaborateWithinMolecule(program, keywordModule, {
          location: [],
          program: literalValueToSemanticGraph(program),
        }),
    withPhantomData<Elaborated>(),
  )

const elaborateWithinMolecule = (
  molecule: Molecule,
  keywordModule: KeywordModule<`@${string}`>,
  context: ExpressionContext,
): Either<ElaborationError, SemanticGraph> => {
  let possibleExpressionAsObjectNode: ObjectNode & {
    readonly children: Writable<ObjectNode['children']>
  } = makeObjectNode({})
  for (let [key, value] of Object.entries(molecule)) {
    const keyUpdateResult = handleAtomWhichMayNotBeAKeyword(key)
    if (either.isLeft(keyUpdateResult)) {
      // Immediately bail on error.
      return keyUpdateResult
    } else {
      const updatedKey = keyUpdateResult.value
      if (typeof value === 'string') {
        possibleExpressionAsObjectNode.children[updatedKey.atom] =
          makeAtomNode(value)
      } else {
        const result = elaborateWithinMolecule(value, keywordModule, {
          location: [...context.location, key],
          program: context.program,
        })
        if (either.isLeft(result)) {
          // Immediately bail on error.
          return result
        }
        possibleExpressionAsObjectNode.children[updatedKey.atom] = result.value
      }
    }
  }

  const { 0: possibleKeywordAsNode, ...propertiesInNeedOfFinalizationAsNodes } =
    possibleExpressionAsObjectNode.children

  // At this point `possibleExpressionAsObjectNode` may still have raw escape sequences at the top
  // level (whether it is an expression or not).
  for (let [key, value] of Object.entries(
    propertiesInNeedOfFinalizationAsNodes,
  )) {
    if (isAtomNode(value)) {
      const valueUpdateResult = handleAtomWhichMayNotBeAKeyword(value.atom)
      if (either.isLeft(valueUpdateResult)) {
        // Immediately bail on error.
        return valueUpdateResult
      } else {
        const updatedValue = valueUpdateResult.value
        possibleExpressionAsObjectNode.children[key] = updatedValue
      }
    }
  }

  const possibleKeyword = possibleExpressionAsObjectNode.children['0']
  if (possibleKeyword !== undefined && isAtomNode(possibleKeyword)) {
    return handleObjectNodeWhichMayBeAExpression(
      {
        ...possibleExpressionAsObjectNode,
        children: {
          ...possibleExpressionAsObjectNode.children,
          0: possibleKeyword,
        },
      },
      keywordModule,
      context,
    )
  } else {
    // The input was actually just a literal object, not an expression.
    return either.makeRight(possibleExpressionAsObjectNode)
  }
}

const handleObjectNodeWhichMayBeAExpression = <Keyword extends `@${string}`>(
  node: ObjectNode & { readonly children: { readonly 0: AtomNode } },
  keywordModule: KeywordModule<Keyword>,
  context: ExpressionContext,
): Either<ElaborationError, SemanticGraph> => {
  const {
    0: { atom: possibleKeyword },
    ...possibleArguments
  } = node.children
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
              children: {
                ...node.children,
                0: makeAtomNode(unescapeKeywordSigil(possibleKeyword)),
              },
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
): Either<InvalidSyntaxTreeError, AtomNode> => {
  if (/^@[^@]/.test(atom)) {
    return either.makeLeft({
      kind: 'invalidSyntaxTree',
      message: `keywords cannot be used here: ${atom}`,
    })
  } else {
    return either.makeRight(makeAtomNode(unescapeKeywordSigil(atom)))
  }
}

const unescapeKeywordSigil = (value: string) =>
  /^@@/.test(value) ? value.substring(1) : value
