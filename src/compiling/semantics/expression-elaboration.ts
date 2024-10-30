import { either, option, type Either } from '../../adts.js'
import type { ElaborationError, InvalidSyntaxError } from '../../errors.js'
import { withPhantomData, type WithPhantomData } from '../../phantom-data.js'
import {
  isAtomNode,
  literalValueToSemanticGraph,
  makeAtomNode,
  makeObjectNode,
  type AtomNode,
  type ObjectNode,
  type SemanticGraph,
} from '../../semantics.js'
import type { Writable } from '../../utility-types.js'
import type { Atom } from '../parsing/atom.js'
import type { Molecule } from '../parsing/molecule.js'
import type { SyntaxTree } from '../parsing/syntax-tree.js'
import type { Elaborated } from '../stages.js'
import {
  isKeyword,
  keywordTransforms,
  type ExpressionContext,
} from './keywords.js'

export type ElaboratedValue = WithPhantomData<SemanticGraph, Elaborated>

export const elaborate = (
  program: SyntaxTree,
): Either<ElaborationError, ElaboratedValue> =>
  either.map(
    typeof program === 'string'
      ? handleAtomWhichMayNotBeAKeyword(program)
      : elaborateWithinMolecule(program, {
          location: [],
          program: literalValueToSemanticGraph(program),
        }),
    withPhantomData<Elaborated>(),
  )

const elaborateWithinMolecule = (
  molecule: Molecule,
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
        const result = elaborateWithinMolecule(value, {
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
      context,
    )
  } else {
    // The input was actually just a literal object, not an expression.
    return either.makeRight(possibleExpressionAsObjectNode)
  }
}

const handleObjectNodeWhichMayBeAExpression = (
  node: ObjectNode & { readonly children: { readonly 0: AtomNode } },
  context: ExpressionContext,
): Either<ElaborationError, SemanticGraph> => {
  const {
    0: { atom: possibleKeyword },
    ...possibleArguments
  } = node.children
  return option.match(option.fromPredicate(possibleKeyword, isKeyword), {
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
      keywordTransforms[keyword](makeObjectNode(possibleArguments), context),
  })
}

const handleAtomWhichMayNotBeAKeyword = (
  atom: Atom,
): Either<InvalidSyntaxError, AtomNode> => {
  if (/^@[^@]/.test(atom)) {
    return either.makeLeft({
      kind: 'invalidSyntax',
      message: `keywords cannot be used here: ${atom}`,
    })
  } else {
    return either.makeRight(makeAtomNode(unescapeKeywordSigil(atom)))
  }
}

const unescapeKeywordSigil = (value: string) =>
  /^@@/.test(value) ? value.substring(1) : value
