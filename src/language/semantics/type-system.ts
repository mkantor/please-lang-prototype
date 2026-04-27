export * as types from './type-system/prelude-types.js'
export { showType } from './type-system/show-type.js'
export { isAssignable } from './type-system/subtyping.js'
export type { Type } from './type-system/type-formats.js'
export {
  inferType,
  resolveParameterTypes,
} from './type-system/type-inference.js'
export {
  applyKeyPathToType,
  containedTypeParameters,
  getTypesForTypeParameters,
  literalTypeFromSemanticGraph,
  replaceAllTypeParametersWithTheirConstraints,
  supplyTypeArgument,
  supplyTypeArguments,
} from './type-system/type-utilities.js'
