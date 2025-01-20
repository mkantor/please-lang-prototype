import * as eitherUtilities from './adts/either-utilities.js'
import * as eitherAdt from './adts/either.js'

export type { Either } from './adts/either.js'
export const either = { ...eitherAdt, ...eitherUtilities }
