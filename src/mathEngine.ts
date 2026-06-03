import { evaluate } from 'mathjs'
import nerdamer from 'nerdamer'
import 'nerdamer/Calculus'
import {
  type Geometry2DObject,
  type Point2D,
  type Primitive3DObject,
  parseGeometry2DObject,
  parsePrimitive3DObject,
  splitTopLevelComma,
} from './geometryObjectModel'

export type AngleMode = 'rad' | 'deg'
export type VisualizationMode = 'auto' | 'fx' | 'fxy'
export type AnalysisMode = 'function' | 'derivative' | 'integral'
export type MathObjectKind =
  | 'complex'
  | 'function2d'
  | 'geometry2d'
  | 'primitive3d'
  | 'ratio'
  | 'scalar'
  | 'surface3d'
  | 'vector'

export type RootAnalysis =
  | { kind: 'identity'; roots: number[] }
  | { kind: 'invalid'; roots: number[] }
  | { kind: 'none'; roots: number[] }
  | { kind: 'not-function'; roots: number[] }
  | { kind: 'roots'; roots: number[] }

export type DivisionParts = {
  denominator: number
  fraction: number
  numerator: number
  remainder: number | null
  value: number
  whole: number
}

export type VectorParts = {
  angle: number
  magnitude: number
  x: number
  y: number
}

export type ComplexParts = {
  angle: number
  conjugate: string
  im: number
  magnitude: number
  re: number
}

export type MathAnalysis = {
  activeExpression: string
  activeRootAnalysis: RootAnalysis
  complex: ComplexParts | null
  geometry: Geometry2DObject | null
  integralArea: number | null
  kind: MathObjectKind
  primitive3d: Primitive3DObject | null
  rootAnalysis: RootAnalysis
  symbolicDerivative: string | null
  symbolicIntegral: string | null
  vector: VectorParts | null
  yIntercept: number | null
}

type MathToken = {
  type: 'comma' | 'function' | 'identifier' | 'lparen' | 'number' | 'operator' | 'rparen'
  value: string
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

const mathFunctionNames = new Set([
  'abs',
  'acos',
  'asin',
  'atan',
  'cbrt',
  'cos',
  'cosh',
  'ln',
  'log',
  'log2',
  'log10',
  'nthRoot',
  'rand',
  'sin',
  'sinh',
  'sqrt',
  'tan',
  'tanh',
])

const superscriptCharacters = '⁰¹²³⁴⁵⁶⁷⁸⁹⁻'
const superscriptFromPlain: Record<string, string> = {
  '-': '⁻',
  '0': '⁰',
  '1': '¹',
  '2': '²',
  '3': '³',
  '4': '⁴',
  '5': '⁵',
  '6': '⁶',
  '7': '⁷',
  '8': '⁸',
  '9': '⁹',
}
const plainFromSuperscript = Object.fromEntries(
  Object.entries(superscriptFromPlain).map(([plain, superscript]) => [superscript, plain]),
)
const vulgarFractionCharacters = '¼½¾⅐⅑⅒⅓⅔⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞'
const vulgarFractionFromPlain: Record<string, string> = {
  '1/2': '½',
  '1/3': '⅓',
  '2/3': '⅔',
  '1/4': '¼',
  '3/4': '¾',
  '1/5': '⅕',
  '2/5': '⅖',
  '3/5': '⅗',
  '4/5': '⅘',
  '1/6': '⅙',
  '5/6': '⅚',
  '1/7': '⅐',
  '1/8': '⅛',
  '3/8': '⅜',
  '5/8': '⅝',
  '7/8': '⅞',
  '1/9': '⅑',
  '1/10': '⅒',
}
export const plainFromVulgarFraction = Object.fromEntries(
  Object.entries(vulgarFractionFromPlain).map(([plain, fraction]) => [fraction, plain]),
)

const toSuperscript = (value: string) =>
  value.replace(/[-0-9]/g, (character) => superscriptFromPlain[character] ?? character)

const fromSuperscript = (value: string) =>
  value.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁻]/g, (character) => plainFromSuperscript[character] ?? character)

const formatExponentsInput = (expression: string) => {
  let formatted = ''

  for (let index = 0; index < expression.length; index += 1) {
    const character = expression[index]
    const previousFormattedCharacter = formatted.at(-1) ?? ''

    if (character === '^') {
      let exponentEnd = index + 1
      if (expression[exponentEnd] === '-') {
        exponentEnd += 1
      }

      while (/\d/.test(expression[exponentEnd] ?? '')) {
        exponentEnd += 1
      }

      const exponent = expression.slice(index + 1, exponentEnd)
      const nextCharacter = expression[exponentEnd]
      const isChainedExponent = /\^-?\d+$/.test(expression.slice(0, index))
      const canFormatExponent =
        exponent.length > 0 &&
        exponent !== '-' &&
        !superscriptCharacters.includes(previousFormattedCharacter) &&
        !isChainedExponent &&
        nextCharacter !== '^'

      if (canFormatExponent) {
        formatted += toSuperscript(exponent)
        index = exponentEnd - 1
        continue
      }
    }

    if (superscriptCharacters.includes(character)) {
      let digitEnd = index + 1
      while (/\d/.test(expression[digitEnd] ?? '')) {
        digitEnd += 1
      }

      formatted += `${character}${toSuperscript(expression.slice(index + 1, digitEnd))}`
      index = digitEnd - 1
      continue
    }

    formatted += character
  }

  return formatted
}

export const formatExpressionInput = (expression: string) =>
  formatExponentsInput(expression)
    .replace(
      /(?<![0-9A-Za-z.)\]}>⁰¹²³⁴⁵⁶⁷⁸⁹⁻])([1-9])\/(10|[2-9])(?![0-9A-Za-z({[<⁰¹²³⁴⁵⁶⁷⁸⁹⁻])/g,
      (match) => vulgarFractionFromPlain[match] ?? match,
    )

export const expandFormattedExponents = (expression: string) =>
  expression.replace(
    new RegExp(`[${superscriptCharacters}]+`, 'g'),
    (exponent) => `^${fromSuperscript(exponent)}`,
  )

export const expandFormattedFractions = (expression: string) =>
  expression.replace(
    new RegExp(`[${vulgarFractionCharacters}]`, 'g'),
    (fraction) => `(${plainFromVulgarFraction[fraction]})`,
  )

export const normalizeExpressionForMath = (expression: string) => {
  const compact = expandFormattedFractions(expandFormattedExponents(expression))
    .replaceAll('−', '-')
    .replaceAll('×', '*')
    .replaceAll('÷', '/')
    .replaceAll('π', 'pi')
    .replace(/\s+/g, '')
  const tokens: MathToken[] = []

  for (let index = 0; index < compact.length; ) {
    const current = compact[index]
    const numberMatch = compact.slice(index).match(/^(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/)

    if (numberMatch) {
      tokens.push({ type: 'number', value: numberMatch[0] })
      index += numberMatch[0].length
      continue
    }

    if (/[A-Za-z]/.test(current)) {
      const letterMatch = compact.slice(index).match(/^[A-Za-z]+/)
      const letters = letterMatch?.[0] ?? current
      let value = letters

      if (letters === 'log' && compact.slice(index + letters.length).startsWith('10(')) {
        value = 'log10'
      } else if (letters === 'log' && compact.slice(index + letters.length).startsWith('2(')) {
        value = 'log2'
      }

      const next = compact[index + value.length]
      tokens.push({
        type: mathFunctionNames.has(value) && next === '(' ? 'function' : 'identifier',
        value,
      })
      index += value.length
      continue
    }

    if (current === '(') {
      tokens.push({ type: 'lparen', value: current })
    } else if (current === ')') {
      tokens.push({ type: 'rparen', value: current })
    } else if (current === ',') {
      tokens.push({ type: 'comma', value: current })
    } else {
      tokens.push({ type: 'operator', value: current })
    }

    index += 1
  }

  return tokens.reduce((normalized, token, index) => {
    const previous = tokens[index - 1]
    const previousCanEndFactor =
      previous?.type === 'number' ||
      previous?.type === 'identifier' ||
      previous?.type === 'rparen' ||
      previous?.value === '!'
    const currentCanStartFactor =
      token.type === 'number' ||
      token.type === 'identifier' ||
      token.type === 'function' ||
      token.type === 'lparen'
    const needsImplicitMultiplication =
      previousCanEndFactor &&
      currentCanStartFactor &&
      !(previous?.type === 'function' && token.type === 'lparen')

    return `${normalized}${needsImplicitMultiplication ? '*' : ''}${token.value}`
  }, '')
}

export const formatExpressionForDisplay = (expression: string, divideSymbol: '/' | '÷' = '÷') =>
  formatExpressionInput(expression)
    .replaceAll('nthRoot', 'ʸ√')
    .replaceAll('cbrt', '∛')
    .replaceAll('log10', 'log₁₀')
    .replaceAll('log2', 'log₂')
    .replaceAll('sqrt', '√')
    .replace(/\bpi\b/g, 'π')
    .replaceAll('*', '×')
    .replace(/(?<=[0-9πe)])×(?=[xytπe√])/g, '')
    .replace(/(?<=[xyt])×(?=\()/g, '')
    .replaceAll('/', divideSymbol)

export const displayExpression = (expression: string) => formatExpressionForDisplay(expression, '÷')

export const toSymbolicExpression = (expression: string) =>
  normalizeExpressionForMath(expression)
    .replaceAll('pi', 'PI')
    .replaceAll('log10', 'log')
    .replaceAll('ln(', 'log(')

export const fromSymbolicExpression = (expression: string) =>
  expression
    .replaceAll('PI', 'pi')
    .replaceAll('ln(', 'log(')

export const getSymbolicTransform = (expression: string, transform: 'derivative' | 'integral') => {
  try {
    const symbolicExpression = toSymbolicExpression(expression)

    if (!symbolicExpression || !/\b[x]\b/.test(symbolicExpression) || /\by\b/.test(symbolicExpression)) {
      return null
    }

    const result =
      transform === 'derivative'
        ? nerdamer.diff(symbolicExpression, 'x')
        : nerdamer.integrate(symbolicExpression, 'x')

    return fromSymbolicExpression(result.toString())
  } catch {
    return null
  }
}

export const formatValue = (value: unknown) => {
  const numeric = Number(value)

  if (!Number.isFinite(numeric)) {
    return String(value)
  }

  if (Math.abs(numeric) >= 1e12 || (Math.abs(numeric) > 0 && Math.abs(numeric) < 1e-8)) {
    return numeric.toExponential(8).replace(/\.?0+e/, 'e')
  }

  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 10,
    maximumSignificantDigits: 12,
  }).format(numeric)
}

export const formatNumberForExpression = (value: number) => {
  if (!Number.isFinite(value)) {
    return String(value)
  }

  const numeric = Object.is(value, -0) ? 0 : value

  return numeric
    .toPrecision(12)
    .replace(/\.?0+(?=e)/i, '')
    .replace(/(\.\d*?)0+$/, '$1')
    .replace(/\.$/, '')
    .replace('e+', 'e')
}

export const buildScope = (angleMode: AngleMode, extraScope: Record<string, number> = {}) => {
  const toRadians = (value: number) => (angleMode === 'deg' ? (value * Math.PI) / 180 : value)
  const fromRadians = (value: number) => (angleMode === 'deg' ? (value * 180) / Math.PI : value)
  const nthRoot = (value: number, root: number) => {
    if (root === 0) {
      return NaN
    }

    const rootIsOddInteger = Number.isInteger(root) && Math.abs(root % 2) === 1
    if (value < 0 && rootIsOddInteger) {
      return -(Math.abs(value) ** (1 / root))
    }

    return value ** (1 / root)
  }

  return {
    pi: Math.PI,
    tau: Math.PI * 2,
    e: Math.E,
    sqrt: (value: number) => Math.sqrt(value),
    cbrt: (value: number) => Math.cbrt(value),
    nthRoot,
    sin: (value: number) => Math.sin(toRadians(value)),
    cos: (value: number) => Math.cos(toRadians(value)),
    tan: (value: number) => Math.tan(toRadians(value)),
    asin: (value: number) => fromRadians(Math.asin(value)),
    acos: (value: number) => fromRadians(Math.acos(value)),
    atan: (value: number) => fromRadians(Math.atan(value)),
    sinh: (value: number) => Math.sinh(value),
    cosh: (value: number) => Math.cosh(value),
    tanh: (value: number) => Math.tanh(value),
    abs: (value: number) => Math.abs(value),
    ln: (value: number) => Math.log(value),
    log: (value: number) => Math.log10(value),
    log10: (value: number) => Math.log10(value),
    log2: (value: number) => Math.log2(value),
    rand: () => Math.random(),
    ...extraScope,
  }
}

export const tryEvaluate = (
  expression: string,
  angleMode: AngleMode,
  extraScope?: Record<string, number>,
) => {
  const normalizedExpression = normalizeExpressionForMath(expression)

  if (!normalizedExpression.trim()) {
    return null
  }

  return evaluate(normalizedExpression, buildScope(angleMode, extraScope))
}

export const evaluateNumeric = (
  expression: string,
  angleMode: AngleMode,
  extraScope?: Record<string, number>,
) => {
  try {
    const value = tryEvaluate(expression, angleMode, extraScope)
    const numeric = Number(value)
    return Number.isFinite(numeric) ? numeric : null
  } catch {
    return null
  }
}

export const parseSimpleDivision = (expression: string): DivisionParts | null => {
  const compact = normalizeExpressionForMath(expression)
  const match = compact.match(/^(-?\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)$/)
  if (!match) {
    return null
  }

  const numerator = Number(match[1])
  const denominator = Number(match[2])
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
    return null
  }

  const value = numerator / denominator
  const magnitude = Math.abs(value)
  const whole = Math.floor(magnitude)
  const fraction = magnitude - whole
  const remainder =
    Number.isInteger(numerator) && Number.isInteger(denominator)
      ? Math.abs(numerator) % Math.abs(denominator)
      : null

  return {
    denominator: Math.abs(denominator),
    fraction,
    numerator,
    remainder,
    value,
    whole,
  }
}

export const parseGeometry = (expression: string, angleMode: AngleMode) =>
  parseGeometry2DObject(expression, (value) => evaluateNumeric(value, angleMode)) ??
  parseStandardHyperbola(expression, angleMode)

const stripOuterParens = (value: string) => {
  let current = value.trim()
  let changed = true

  while (changed && current.startsWith('(') && current.endsWith(')')) {
    changed = false
    let depth = 0
    let wrapsWholeValue = true

    for (let index = 0; index < current.length; index += 1) {
      const character = current[index]
      if (character === '(') {
        depth += 1
      } else if (character === ')') {
        depth -= 1
        if (depth === 0 && index < current.length - 1) {
          wrapsWholeValue = false
          break
        }
      }
    }

    if (wrapsWholeValue) {
      current = current.slice(1, -1).trim()
      changed = true
    }
  }

  return current
}

const splitAtTopLevelOperator = (value: string, operator: string, startIndex = 0) => {
  let depth = 0

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index]
    if (character === '(' || character === '[' || character === '<') {
      depth += 1
    } else if (character === ')' || character === ']' || character === '>') {
      depth -= 1
    } else if (character === operator && depth === 0 && index >= startIndex) {
      return [value.slice(0, index), value.slice(index + 1)] as const
    }
  }

  return null
}

const parseSquaredVariableTerm = (term: string, angleMode: AngleMode) => {
  const compact = stripOuterParens(term)
  const division = splitAtTopLevelOperator(compact, '/')
  const numerator = stripOuterParens(division?.[0] ?? compact)
  const denominatorExpression = division?.[1] ?? '1'
  const numeratorMatch = numerator.match(/^([xy])\^2$/)

  if (!numeratorMatch) {
    return null
  }

  const denominator = evaluateNumeric(denominatorExpression, angleMode)
  if (denominator === null || denominator <= 0) {
    return null
  }

  return {
    denominator,
    variable: numeratorMatch[1] as 'x' | 'y',
  }
}

export const parseStandardHyperbola = (
  expression: string,
  angleMode: AngleMode,
): Geometry2DObject | null => {
  const compact = normalizeExpressionForMath(expression).replace(/\s+/g, '')
  const equation = splitAtTopLevelOperator(compact, '=')
  if (!equation) {
    return null
  }

  const [leftExpression, rightExpression] = equation
  const subtraction = splitAtTopLevelOperator(stripOuterParens(leftExpression), '-', 1)
  if (!subtraction) {
    return null
  }

  const positiveTerm = parseSquaredVariableTerm(subtraction[0], angleMode)
  const negativeTerm = parseSquaredVariableTerm(subtraction[1], angleMode)
  let rightValue = evaluateNumeric(rightExpression, angleMode)

  if (!positiveTerm || !negativeTerm || rightValue === null || rightValue === 0) {
    return null
  }

  if (positiveTerm.variable === negativeTerm.variable) {
    return null
  }

  let transverseTerm = positiveTerm
  let conjugateTerm = negativeTerm
  if (rightValue < 0) {
    transverseTerm = negativeTerm
    conjugateTerm = positiveTerm
    rightValue = Math.abs(rightValue)
  }

  const a = Math.sqrt(transverseTerm.denominator * rightValue)
  const b = Math.sqrt(conjugateTerm.denominator * rightValue)
  const c = Math.hypot(a, b)
  const transverseAxis = transverseTerm.variable
  const center = { x: 0, y: 0 }
  const vertices: [Point2D, Point2D] =
    transverseAxis === 'x'
      ? [
          { x: -a, y: 0 },
          { x: a, y: 0 },
        ]
      : [
          { x: 0, y: -a },
          { x: 0, y: a },
        ]
  const foci: [Point2D, Point2D] =
    transverseAxis === 'x'
      ? [
          { x: -c, y: 0 },
          { x: c, y: 0 },
        ]
      : [
          { x: 0, y: -c },
          { x: 0, y: c },
        ]
  const slopeMagnitude = transverseAxis === 'x' ? b / a : a / b

  return {
    a,
    asymptoteSlopes: [-slopeMagnitude, slopeMagnitude],
    b,
    c,
    center,
    eccentricity: c / a,
    foci,
    kind: 'hyperbola',
    transverseAxis,
    vertices,
  }
}

export const parsePrimitive3D = (expression: string, angleMode: AngleMode) =>
  parsePrimitive3DObject(expression, (value) => evaluateNumeric(value, angleMode))

export const parseVector = (expression: string, angleMode: AngleMode): VectorParts | null => {
  const trimmed = expression.trim()
  const vectorMatch =
    trimmed.match(/^<(.+)>$/) ?? trimmed.match(/^\[(.+)\]$/) ?? trimmed.match(/^vec\((.+)\)$/i)

  if (!vectorMatch) {
    return null
  }

  const pair = splitTopLevelComma(vectorMatch[1])
  if (!pair) {
    return null
  }

  const x = evaluateNumeric(pair[0], angleMode)
  const y = evaluateNumeric(pair[1], angleMode)
  if (x === null || y === null) {
    return null
  }

  return {
    angle: (Math.atan2(y, x) * 180) / Math.PI,
    magnitude: Math.hypot(x, y),
    x,
    y,
  }
}

export const parseComplex = (expression: string): ComplexParts | null => {
  const compact = expression.replace(/\s+/g, '').replaceAll('−', '-').toLowerCase()
  if (!compact.endsWith('i') || /[xyt]/.test(compact)) {
    return null
  }

  const withoutI = compact.slice(0, -1)
  let re = 0
  let imPart = withoutI
  let splitIndex = -1

  for (let index = 1; index < withoutI.length; index += 1) {
    if (withoutI[index] === '+' || withoutI[index] === '-') {
      splitIndex = index
    }
  }

  if (splitIndex > 0) {
    re = Number(withoutI.slice(0, splitIndex))
    imPart = withoutI.slice(splitIndex)
  }

  const im =
    imPart === '' || imPart === '+'
      ? 1
      : imPart === '-'
        ? -1
        : Number(imPart)

  if (!Number.isFinite(re) || !Number.isFinite(im)) {
    return null
  }

  const sign = im < 0 ? '-' : '+'
  const absIm = Math.abs(im)

  return {
    angle: (Math.atan2(im, re) * 180) / Math.PI,
    conjugate: `${formatValue(re)} ${sign === '+' ? '-' : '+'} ${formatValue(absIm)}i`,
    im,
    magnitude: Math.hypot(re, im),
    re,
  }
}

export const evaluateForPoint = (expression: string, angleMode: AngleMode, x: number, y = 0) => {
  const numeric = evaluateNumeric(expression, angleMode, { x, y, t: x })
  return numeric === null ? null : clamp(numeric, -8, 8)
}

export const evaluateRawForPoint = (expression: string, angleMode: AngleMode, x: number) =>
  evaluateNumeric(expression, angleMode, { x, t: x, y: 0 })

export const derivativeAt = (expression: string, angleMode: AngleMode, x: number) => {
  const h = 0.0001
  const left = evaluateRawForPoint(expression, angleMode, x - h)
  const right = evaluateRawForPoint(expression, angleMode, x + h)

  if (left === null || right === null) {
    return null
  }

  return (right - left) / (2 * h)
}

export const integrate = (expression: string, angleMode: AngleMode, a: number, b: number) => {
  const steps = 240
  const width = (b - a) / steps
  let total = 0

  for (let index = 0; index <= steps; index += 1) {
    const x = a + width * index
    const value = evaluateRawForPoint(expression, angleMode, x)

    if (value === null) {
      return null
    }

    const weight = index === 0 || index === steps ? 1 : index % 2 === 0 ? 2 : 4
    total += weight * value
  }

  return (total * width) / 3
}

export const analyzeRoots = (expression: string, angleMode: AngleMode): RootAnalysis => {
  const expr = normalizeExpressionForMath(expression)
  if (!expr || !/\b[xt]\b/.test(expr) || /\by\b/.test(expr)) {
    return { kind: 'not-function', roots: [] }
  }

  const min = -10
  const max = 10
  const steps = 500
  const epsilon = 1e-6
  const roots: number[] = []
  let finiteSamples = 0
  let zeroSamples = 0
  let previousX: number | null = null
  let previousY: number | null = null

  const addRoot = (root: number) => {
    if (!Number.isFinite(root) || root < min - 0.001 || root > max + 0.001) {
      return
    }

    if (!roots.some((existing) => Math.abs(existing - root) < 0.01)) {
      roots.push(root)
    }
  }

  for (let index = 0; index <= steps; index += 1) {
    const x = min + ((max - min) * index) / steps
    const y = evaluateRawForPoint(expr, angleMode, x)

    if (y === null || Math.abs(y) > 1e8) {
      previousX = null
      previousY = null
      continue
    }

    finiteSamples += 1

    if (Math.abs(y) < epsilon) {
      zeroSamples += 1
      addRoot(x)
    }

    if (previousX !== null && previousY !== null && previousY * y < 0) {
      let left = previousX
      let right = x
      let leftValue = previousY

      for (let iteration = 0; iteration < 52; iteration += 1) {
        const mid = (left + right) / 2
        const midValue = evaluateRawForPoint(expr, angleMode, mid)

        if (midValue === null) {
          break
        }

        if (Math.abs(midValue) < 1e-10) {
          left = mid
          right = mid
          break
        }

        if (leftValue * midValue <= 0) {
          right = mid
        } else {
          left = mid
          leftValue = midValue
        }
      }

      addRoot((left + right) / 2)
    }

    previousX = x
    previousY = y
  }

  if (finiteSamples < 5) {
    return { kind: 'invalid', roots: [] }
  }

  if (zeroSamples / finiteSamples > 0.95) {
    return { kind: 'identity', roots: [] }
  }

  const sortedRoots = roots.sort((a, b) => a - b)
  return sortedRoots.length > 0
    ? { kind: 'roots', roots: sortedRoots }
    : { kind: 'none', roots: [] }
}

export const resolveVisualizationMode = (expression: string, visualizationMode: VisualizationMode) => {
  const normalizedExpression = normalizeExpressionForMath(expression)

  if (visualizationMode !== 'auto') {
    return visualizationMode
  }

  if (/\by\b/.test(normalizedExpression)) {
    return 'fxy'
  }

  if (/\b[xt]\b/.test(normalizedExpression)) {
    return 'fx'
  }

  return 'auto'
}

export const getMathKind = (
  expression: string,
  angleMode: AngleMode,
  visualizationMode: VisualizationMode,
): MathObjectKind => {
  if (parseGeometry(expression, angleMode)) {
    return 'geometry2d'
  }

  if (parsePrimitive3D(expression, angleMode)) {
    return 'primitive3d'
  }

  if (parseVector(expression, angleMode)) {
    return 'vector'
  }

  if (parseComplex(expression)) {
    return 'complex'
  }

  const resolvedMode = resolveVisualizationMode(expression, visualizationMode)
  if (resolvedMode === 'fxy') {
    return 'surface3d'
  }

  if (resolvedMode === 'fx') {
    return 'function2d'
  }

  if (parseSimpleDivision(expression)) {
    return 'ratio'
  }

  return 'scalar'
}

const formatRoot = (root: number) => (Math.abs(root) < 0.000001 ? '0' : formatValue(root))

export const formatRootAnalysis = (analysis: RootAnalysis) => {
  switch (analysis.kind) {
    case 'identity':
      return 'all real x'
    case 'invalid':
      return 'not solvable'
    case 'none':
      return 'no real roots in [-10, 10]'
    case 'roots':
      return `x = ${analysis.roots.map(formatRoot).join(', ')}`
    case 'not-function':
    default:
      return ''
  }
}

export const makeAnalysis = (
  expression: string,
  angleMode: AngleMode,
  visualizationMode: VisualizationMode,
  analysisMode: AnalysisMode,
): MathAnalysis => {
  const geometry = parseGeometry(expression, angleMode)
  const primitive3d = parsePrimitive3D(expression, angleMode)
  const vector = parseVector(expression, angleMode)
  const complex = parseComplex(expression)
  const kind = getMathKind(expression, angleMode, visualizationMode)
  const isFunction = kind === 'function2d'
  const symbolicDerivative = isFunction ? getSymbolicTransform(expression, 'derivative') : null
  const symbolicIntegral = isFunction ? getSymbolicTransform(expression, 'integral') : null
  const activeExpression =
    isFunction && analysisMode === 'derivative' && symbolicDerivative
      ? symbolicDerivative
      : isFunction && analysisMode === 'integral' && symbolicIntegral
        ? symbolicIntegral
        : expression
  const rootAnalysis = isFunction ? analyzeRoots(expression, angleMode) : { kind: 'not-function' as const, roots: [] }

  return {
    activeExpression,
    activeRootAnalysis: isFunction
      ? analyzeRoots(activeExpression, angleMode)
      : { kind: 'not-function', roots: [] },
    complex,
    geometry,
    integralArea: isFunction ? integrate(expression, angleMode, -2, 2) : null,
    kind,
    primitive3d,
    rootAnalysis,
    symbolicDerivative,
    symbolicIntegral,
    vector,
    yIntercept: isFunction ? evaluateRawForPoint(activeExpression, angleMode, 0) : null,
  }
}

export const isDisplayMathKind = (kind: MathObjectKind) =>
  kind === 'function2d' ||
  kind === 'geometry2d' ||
  kind === 'primitive3d' ||
  kind === 'surface3d' ||
  kind === 'vector' ||
  kind === 'complex'

export const evaluateMathAnalysis = (
  expression: string,
  angleMode: AngleMode,
  mathAnalysis: MathAnalysis,
) => {
  try {
    if (mathAnalysis.kind === 'vector') {
      return { label: 'vector', numeric: mathAnalysis.vector?.magnitude ?? null, valid: true }
    }

    if (mathAnalysis.kind === 'complex') {
      return { label: 'complex', numeric: mathAnalysis.complex?.magnitude ?? null, valid: true }
    }

    if (mathAnalysis.kind === 'geometry2d') {
      return { label: 'geometry', numeric: null, valid: true }
    }

    if (mathAnalysis.kind === 'primitive3d') {
      return {
        label:
          mathAnalysis.primitive3d?.kind === 'line3d'
            ? '3D line'
            : mathAnalysis.primitive3d?.kind ?? '3D object',
        numeric: null,
        valid: true,
      }
    }

    if (mathAnalysis.kind === 'function2d') {
      return { label: 'function', numeric: null, valid: true }
    }

    if (mathAnalysis.kind === 'surface3d') {
      return { label: 'surface', numeric: null, valid: true }
    }

    const value = tryEvaluate(expression, angleMode)
    return {
      label: value === null ? '0' : formatValue(value),
      numeric: Number(value),
      valid: true,
    }
  } catch {
    return {
      label: 'syntax',
      numeric: null,
      valid: false,
    }
  }
}

export const insertPercent = (expression: string) =>
  expression.replace(/(\d+\.?\d*)$/, (_, value) => String(Number(value) / 100))

export const toggleSign = (expression: string) => {
  if (!expression.trim() || expression === '0') {
    return '-'
  }

  const numberPattern = String.raw`(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?`
  const parenthesizedNegativeMatch = expression.match(new RegExp(String.raw`\(-(${numberPattern})\)$`))
  if (parenthesizedNegativeMatch?.index !== undefined) {
    return `${expression.slice(0, parenthesizedNegativeMatch.index)}${parenthesizedNegativeMatch[1]}`
  }

  const match = expression.match(new RegExp(String.raw`(-?${numberPattern})$`))
  if (!match || match.index === undefined) {
    return `-(${expression})`
  }

  const value = match[1]
  const nextValue = value.startsWith('-') ? value.slice(1) : `(-${value})`
  return `${expression.slice(0, match.index)}${nextValue}`
}

const isUnaryMinus = (expression: string, index: number) => {
  if (expression[index] !== '-') {
    return false
  }

  const previous = expression.slice(0, index).trimEnd().at(-1)
  return previous === undefined || /[+\-*/^(,]/.test(previous)
}

const isExponentMinus = (expression: string, index: number) => {
  if (expression[index] !== '-') {
    return false
  }

  const previous = expression[index - 1]
  return previous === '^' || previous === 'e' || previous === 'E'
}

const matchingOpenBracket = (closeBracket: string) =>
  closeBracket === ')' ? '(' : closeBracket === ']' ? '[' : '<'

const findMatchingOpenBracket = (expression: string, closeIndex: number) => {
  const closeBracket = expression[closeIndex]
  const openBracket = matchingOpenBracket(closeBracket)
  let depth = 0

  for (let index = closeIndex; index >= 0; index -= 1) {
    const character = expression[index]
    if (character === closeBracket) {
      depth += 1
    } else if (character === openBracket) {
      depth -= 1
      if (depth === 0) {
        return index
      }
    }
  }

  return closeIndex
}

const getCurrentTermBounds = (expression: string) => {
  const end = expression.trimEnd().length
  if (end === 0) {
    return { end, start: 0 }
  }

  const lastCharacter = expression[end - 1]
  if (/[+\-*/,(]/.test(lastCharacter)) {
    return { end, start: end }
  }

  if (/[)\]>]/.test(lastCharacter)) {
    let start = findMatchingOpenBracket(expression, end - 1)
    while (/[A-Za-z]/.test(expression[start - 1] ?? '')) {
      start -= 1
    }
    if (isUnaryMinus(expression, start - 1)) {
      start -= 1
    }
    return { end, start }
  }

  let start = end
  for (let index = end - 1; index >= 0; index -= 1) {
    const character = expression[index]
    if (
      [',', '+', '*', '/'].includes(character) ||
      (character === '-' && !isUnaryMinus(expression, index) && !isExponentMinus(expression, index))
    ) {
      start = index + 1
      while (/\s/.test(expression[start] ?? '')) {
        start += 1
      }
      break
    }
    start = index
  }

  return { end, start }
}

export const encloseExpressionInFunction = (
  expression: string,
  functionName: string,
  options: { closeExpression?: boolean; suffix?: string } = {},
) => {
  const currentExpression = expression.trim()
  const closeExpression = options.closeExpression ?? true
  const suffix = options.suffix ?? ''
  if (!currentExpression || currentExpression === '0') {
    return `${functionName}(`
  }

  const { end, start } = getCurrentTermBounds(expression)
  const currentTerm = expression.slice(start, end)
  if (!currentTerm.trim()) {
    return `${expression.slice(0, end)}${functionName}(`
  }

  return `${expression.slice(0, start)}${functionName}(${currentTerm}${suffix}${closeExpression ? ')' : ''}${expression.slice(end)}`
}

const expressionEndsWithBinaryOperator = (expression: string) => /[+\-*/]$/.test(expression)

const currentNumberHasDecimal = (expression: string) => {
  const normalizedExpression = expandFormattedExponents(expression)
  const currentNumber = normalizedExpression.split(/[+\-*/^(),]/).at(-1) ?? ''
  return currentNumber.includes('.')
}

export const appendToken = (expression: string, token: string) => {
  const currentExpression = expression.trim() || '0'
  const lastCharacter = currentExpression.at(-1) ?? ''
  const tokenIsBinaryOperator = ['+', '-', '*', '/'].includes(token)
  const tokenIsPostfixPower = ['^2', '^3'].includes(token)
  const tokenStartsExpression =
    /^\d/.test(token) || /^[A-Za-z<[]/.test(token) || token === '(' || token === '-'

  if (token === '.') {
    if (currentNumberHasDecimal(currentExpression)) {
      return currentExpression
    }

    if (currentExpression === '0') {
      return '0.'
    }

    if (/[+\-*/^(,]$/.test(currentExpression)) {
      return `${currentExpression}0.`
    }
  }

  if (tokenIsBinaryOperator) {
    if (currentExpression === '0') {
      return token === '-' ? '-' : `0${token}`
    }

    if (currentExpression === '-') {
      return token === '-' ? currentExpression : `0${token}`
    }

    if (expressionEndsWithBinaryOperator(currentExpression) || lastCharacter === '^') {
      return `${currentExpression.slice(0, -1)}${token}`
    }

    if ((lastCharacter === '(' || lastCharacter === ',') && token !== '-') {
      return currentExpression
    }
  }

  if (currentExpression === '0' && tokenStartsExpression) {
    return token
  }

  if (tokenIsPostfixPower) {
    const { end, start } = getCurrentTermBounds(currentExpression)
    const currentTerm = currentExpression.slice(start, end)
    if (currentTerm.startsWith('-')) {
      return `${currentExpression.slice(0, start)}(${currentTerm})${token}${currentExpression.slice(end)}`
    }
  }

  return `${currentExpression}${token}`
}

export const shouldContinueEvaluatedResult = (token: string) =>
  ['+', '-', '*', '/', '^', '^2', '^3'].includes(token)
