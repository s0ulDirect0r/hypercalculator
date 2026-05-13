import { type ChangeEvent, type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { evaluate } from 'mathjs'
import nerdamer from 'nerdamer'
import 'nerdamer/Calculus'
import {
  Box,
  Circle,
  CircleDot,
  Cone,
  Cuboid,
  Cylinder,
  Delete,
  Dices,
  Hash,
  History,
  RotateCcw,
  Shapes,
  Sparkles,
  Spline,
  Square,
  Triangle,
  WandSparkles,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import * as THREE from 'three'
import {
  type Geometry2DObject,
  type Point2D,
  type Point3D,
  type Primitive3DObject,
  parseGeometry2DObject,
  parsePrimitive3DObject,
  splitTopLevelComma,
} from './geometryObjectModel'
import './App.css'

type AngleMode = 'rad' | 'deg'
type VisualizationMode = 'auto' | 'fx' | 'fxy'
type AnalysisMode = 'function' | 'derivative' | 'integral'
type GeometryComposerKind =
  | 'circle'
  | 'cone'
  | 'cube'
  | 'cylinder'
  | 'line3d'
  | 'plane'
  | 'point'
  | 'segment'
  | 'sphere'
  | 'triangle'
type MathObjectKind =
  | 'complex'
  | 'function2d'
  | 'geometry2d'
  | 'primitive3d'
  | 'ratio'
  | 'scalar'
  | 'surface3d'
  | 'vector'
type HistoryItem = {
  expression: string
  value: string
}
type RootAnalysis =
  | { kind: 'identity'; roots: number[] }
  | { kind: 'invalid'; roots: number[] }
  | { kind: 'none'; roots: number[] }
  | { kind: 'not-function'; roots: number[] }
  | { kind: 'roots'; roots: number[] }
type DivisionParts = {
  denominator: number
  fraction: number
  numerator: number
  remainder: number | null
  value: number
  whole: number
}
type VectorParts = {
  angle: number
  magnitude: number
  x: number
  y: number
}
type ComplexParts = {
  angle: number
  conjugate: string
  im: number
  magnitude: number
  re: number
}
type MathAnalysis = {
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
type GeometryFieldConfig = {
  key: string
  label: string
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

const geometryComposerConfig: Record<
  GeometryComposerKind,
  {
    dimension: '2d' | '3d'
    fields: GeometryFieldConfig[]
    label: string
  }
> = {
  circle: {
    dimension: '2d',
    fields: [
      { key: 'cx', label: 'cx' },
      { key: 'cy', label: 'cy' },
      { key: 'r', label: 'r' },
    ],
    label: 'circle',
  },
  cone: {
    dimension: '3d',
    fields: [
      { key: 'cx', label: 'cx' },
      { key: 'cy', label: 'cy' },
      { key: 'cz', label: 'cz' },
      { key: 'r', label: 'r' },
      { key: 'h', label: 'h' },
    ],
    label: 'cone',
  },
  cube: {
    dimension: '3d',
    fields: [
      { key: 'cx', label: 'cx' },
      { key: 'cy', label: 'cy' },
      { key: 'cz', label: 'cz' },
      { key: 'side', label: 'side' },
    ],
    label: 'cube',
  },
  cylinder: {
    dimension: '3d',
    fields: [
      { key: 'cx', label: 'cx' },
      { key: 'cy', label: 'cy' },
      { key: 'cz', label: 'cz' },
      { key: 'r', label: 'r' },
      { key: 'h', label: 'h' },
    ],
    label: 'cylinder',
  },
  line3d: {
    dimension: '3d',
    fields: [
      { key: 'ax', label: 'ax' },
      { key: 'ay', label: 'ay' },
      { key: 'az', label: 'az' },
      { key: 'bx', label: 'bx' },
      { key: 'by', label: 'by' },
      { key: 'bz', label: 'bz' },
    ],
    label: 'line',
  },
  plane: {
    dimension: '3d',
    fields: [
      { key: 'nx', label: 'nx' },
      { key: 'ny', label: 'ny' },
      { key: 'nz', label: 'nz' },
      { key: 'd', label: 'd' },
    ],
    label: 'plane',
  },
  point: {
    dimension: '2d',
    fields: [
      { key: 'x', label: 'x' },
      { key: 'y', label: 'y' },
    ],
    label: 'point',
  },
  segment: {
    dimension: '2d',
    fields: [
      { key: 'ax', label: 'ax' },
      { key: 'ay', label: 'ay' },
      { key: 'bx', label: 'bx' },
      { key: 'by', label: 'by' },
    ],
    label: 'segment',
  },
  sphere: {
    dimension: '3d',
    fields: [
      { key: 'cx', label: 'cx' },
      { key: 'cy', label: 'cy' },
      { key: 'cz', label: 'cz' },
      { key: 'r', label: 'r' },
    ],
    label: 'sphere',
  },
  triangle: {
    dimension: '2d',
    fields: [
      { key: 'ax', label: 'ax' },
      { key: 'ay', label: 'ay' },
      { key: 'bx', label: 'bx' },
      { key: 'by', label: 'by' },
      { key: 'cx', label: 'cx' },
      { key: 'cy', label: 'cy' },
    ],
    label: 'triangle',
  },
}

const geometryComposerDefaults: Record<GeometryComposerKind, Record<string, string>> = {
  circle: { cx: '0', cy: '0', r: '3' },
  cone: { cx: '0', cy: '0', cz: '0', h: '5', r: '2' },
  cube: { cx: '0', cy: '0', cz: '0', side: '4' },
  cylinder: { cx: '0', cy: '0', cz: '0', h: '5', r: '2' },
  line3d: { ax: '0', ay: '0', az: '0', bx: '2', by: '3', bz: '1' },
  plane: { d: '0', nx: '0', ny: '1', nz: '0' },
  point: { x: '2', y: '3' },
  segment: { ax: '0', ay: '0', bx: '4', by: '3' },
  sphere: { cx: '0', cy: '0', cz: '0', r: '3' },
  triangle: { ax: '0', ay: '0', bx: '4', by: '0', cx: '1', cy: '3' },
}

const geometryFieldValue = (fields: Record<string, string>, key: string, fallback = '0') =>
  fields[key]?.trim() || fallback

const geometryFieldsComplete = (kind: GeometryComposerKind, fields: Record<string, string>) =>
  geometryComposerConfig[kind].fields.every(({ key }) => fields[key]?.trim())

const buildGeometryExpression = (kind: GeometryComposerKind, fields: Record<string, string>) => {
  const field = (key: string, fallback = '0') => geometryFieldValue(fields, key, fallback)

  switch (kind) {
    case 'point':
      return `point(${field('x')}, ${field('y')})`
    case 'segment':
      return `segment(a=(${field('ax')},${field('ay')}), b=(${field('bx')},${field('by')}))`
    case 'circle':
      return `circle(center=(${field('cx')},${field('cy')}), r=${field('r', '1')})`
    case 'triangle':
      return `triangle(a=(${field('ax')},${field('ay')}), b=(${field('bx')},${field('by')}), c=(${field('cx')},${field('cy')}))`
    case 'line3d':
      return `line3d(a=(${field('ax')},${field('ay')},${field('az')}), b=(${field('bx')},${field('by')},${field('bz')}))`
    case 'sphere':
      return `sphere(center=(${field('cx')},${field('cy')},${field('cz')}), r=${field('r', '1')})`
    case 'cube':
      return `cube(center=(${field('cx')},${field('cy')},${field('cz')}), side=${field('side', '1')})`
    case 'cylinder':
      return `cylinder(center=(${field('cx')},${field('cy')},${field('cz')}), r=${field('r', '1')}, h=${field('h', '1')})`
    case 'cone':
      return `cone(center=(${field('cx')},${field('cy')},${field('cz')}), r=${field('r', '1')}, h=${field('h', '1')})`
    case 'plane':
      return `plane(normal=(${field('nx')},${field('ny', '1')},${field('nz')}), d=${field('d')})`
    default:
      return 'point(0, 0)'
  }
}

const randomInteger = (min: number, max: number) =>
  String(Math.floor(Math.random() * (max - min + 1)) + min)

const randomPositive = (min: number, max: number) => randomInteger(min, max)

const randomGeometryFields = (kind: GeometryComposerKind): Record<string, string> => {
  switch (kind) {
    case 'point':
      return { x: randomInteger(-6, 6), y: randomInteger(-6, 6) }
    case 'segment':
      return { ax: randomInteger(-5, 1), ay: randomInteger(-4, 4), bx: randomInteger(2, 7), by: randomInteger(-4, 4) }
    case 'circle':
      return { cx: randomInteger(-4, 4), cy: randomInteger(-4, 4), r: randomPositive(1, 6) }
    case 'triangle': {
      const ax = Number(randomInteger(-5, -1))
      const ay = Number(randomInteger(-3, 3))
      return {
        ax: String(ax),
        ay: String(ay),
        bx: String(ax + Number(randomPositive(3, 7))),
        by: String(ay),
        cx: String(ax + Number(randomPositive(1, 4))),
        cy: String(ay + Number(randomPositive(2, 6))),
      }
    }
    case 'line3d':
      return {
        ax: randomInteger(-3, 1),
        ay: randomInteger(-3, 3),
        az: randomInteger(-3, 3),
        bx: randomInteger(2, 6),
        by: randomInteger(-3, 3),
        bz: randomInteger(-3, 3),
      }
    case 'sphere':
      return { cx: randomInteger(-3, 3), cy: randomInteger(-3, 3), cz: randomInteger(-3, 3), r: randomPositive(1, 5) }
    case 'cube':
      return { cx: randomInteger(-3, 3), cy: randomInteger(-3, 3), cz: randomInteger(-3, 3), side: randomPositive(1, 5) }
    case 'cylinder':
      return { cx: randomInteger(-3, 3), cy: randomInteger(-3, 3), cz: randomInteger(-3, 3), h: randomPositive(2, 7), r: randomPositive(1, 4) }
    case 'cone':
      return { cx: randomInteger(-3, 3), cy: randomInteger(-3, 3), cz: randomInteger(-3, 3), h: randomPositive(2, 7), r: randomPositive(1, 4) }
    case 'plane': {
      const nx = randomInteger(-2, 2)
      const ny = nx === '0' ? randomPositive(1, 2) : randomInteger(-2, 2)
      return { d: randomInteger(-3, 3), nx, ny, nz: randomInteger(-2, 2) }
    }
    default:
      return geometryComposerDefaults.point
  }
}

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
const plainFromVulgarFraction = Object.fromEntries(
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

const formatExpressionInput = (expression: string) =>
  formatExponentsInput(expression)
    .replace(
      /(?<![0-9A-Za-z.)\]}>⁰¹²³⁴⁵⁶⁷⁸⁹⁻])([1-9])\/(10|[2-9])(?![0-9A-Za-z({[<⁰¹²³⁴⁵⁶⁷⁸⁹⁻])/g,
      (match) => vulgarFractionFromPlain[match] ?? match,
    )

const expandFormattedExponents = (expression: string) =>
  expression.replace(
    new RegExp(`[${superscriptCharacters}]+`, 'g'),
    (exponent) => `^${fromSuperscript(exponent)}`,
  )

const expandFormattedFractions = (expression: string) =>
  expression.replace(
    new RegExp(`[${vulgarFractionCharacters}]`, 'g'),
    (fraction) => `(${plainFromVulgarFraction[fraction]})`,
  )

const normalizeExpressionForMath = (expression: string) => {
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

const formatExpressionForDisplay = (expression: string, divideSymbol: '/' | '÷' = '÷') =>
  formatExpressionInput(expression)
    .replaceAll('nthRoot', 'ʸ√')
    .replaceAll('cbrt', '∛')
    .replaceAll('log10', 'log₁₀')
    .replaceAll('log2', 'log₂')
    .replaceAll('sqrt', '√')
    .replace(/\bpi\b/g, 'π')
    .replaceAll('*', '×')
    .replace(/(?<=[0-9πe)])×(?=[xytπe√(])/g, '')
    .replace(/(?<=[xyt])×(?=\()/g, '')
    .replaceAll('/', divideSymbol)

const displayExpression = (expression: string) => formatExpressionForDisplay(expression, '÷')

const renderMathExpression = (expression: string): ReactNode[] => {
  const formatted = formatExpressionForDisplay(expression, '/').replace(
    /[¼½¾⅓⅔⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞]/g,
    (fraction) => plainFromVulgarFraction[fraction] ?? fraction,
  )
  const nodes: ReactNode[] = []
  const fractionPattern = /(-?\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)/g
  let cursor = 0
  let match: RegExpExecArray | null

  while ((match = fractionPattern.exec(formatted))) {
    if (match.index > cursor) {
      nodes.push(
        <span className="math-run" key={`text-${cursor}`}>
          {formatted.slice(cursor, match.index)}
        </span>,
      )
    }

    nodes.push(
      <span className="math-fraction" key={`fraction-${match.index}`}>
        <span className="math-numerator">{match[1]}</span>
        <span className="math-fraction-line" />
        <span className="math-denominator">{match[2]}</span>
      </span>,
    )

    cursor = match.index + match[0].length
  }

  if (cursor < formatted.length) {
    nodes.push(
      <span className="math-run" key={`text-${cursor}`}>
        {formatted.slice(cursor)}
      </span>,
    )
  }

  return nodes.length > 0 ? nodes : [formatted]
}

const toSymbolicExpression = (expression: string) =>
  normalizeExpressionForMath(expression)
    .replaceAll('pi', 'PI')
    .replaceAll('log10', 'log')
    .replaceAll('ln(', 'log(')

const fromSymbolicExpression = (expression: string) =>
  expression
    .replaceAll('PI', 'pi')
    .replaceAll('ln(', 'log(')

const getSymbolicTransform = (expression: string, transform: 'derivative' | 'integral') => {
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

const formatValue = (value: unknown) => {
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

const buildScope = (angleMode: AngleMode, extraScope: Record<string, number> = {}) => {
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
    ln: (value: number) => Math.log(value),
    log10: (value: number) => Math.log10(value),
    log2: (value: number) => Math.log2(value),
    rand: () => Math.random(),
    ...extraScope,
  }
}

const tryEvaluate = (
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

const evaluateNumeric = (
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

const parseSimpleDivision = (expression: string): DivisionParts | null => {
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

const formatPoint = (point: Point2D) => `(${formatValue(point.x)}, ${formatValue(point.y)})`

const formatPoint3D = (point: Point3D) =>
  `(${formatValue(point.x)}, ${formatValue(point.y)}, ${formatValue(point.z)})`

const parseGeometry = (expression: string, angleMode: AngleMode) =>
  parseGeometry2DObject(expression, (value) => evaluateNumeric(value, angleMode))

const parsePrimitive3D = (expression: string, angleMode: AngleMode) =>
  parsePrimitive3DObject(expression, (value) => evaluateNumeric(value, angleMode))

const parseVector = (expression: string, angleMode: AngleMode): VectorParts | null => {
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

const parseComplex = (expression: string): ComplexParts | null => {
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

const evaluateForPoint = (expression: string, angleMode: AngleMode, x: number, y = 0) => {
  const numeric = evaluateNumeric(expression, angleMode, { x, y, t: x })
  return numeric === null ? null : clamp(numeric, -8, 8)
}

const evaluateRawForPoint = (expression: string, angleMode: AngleMode, x: number) =>
  evaluateNumeric(expression, angleMode, { x, t: x, y: 0 })

const derivativeAt = (expression: string, angleMode: AngleMode, x: number) => {
  const h = 0.0001
  const left = evaluateRawForPoint(expression, angleMode, x - h)
  const right = evaluateRawForPoint(expression, angleMode, x + h)

  if (left === null || right === null) {
    return null
  }

  return (right - left) / (2 * h)
}

const integrate = (expression: string, angleMode: AngleMode, a: number, b: number) => {
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

const analyzeRoots = (expression: string, angleMode: AngleMode): RootAnalysis => {
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

const resolveVisualizationMode = (expression: string, visualizationMode: VisualizationMode) => {
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

const getMathKind = (
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

const getViewportModeLabel = (kind: MathObjectKind) => {
  const labels: Record<MathObjectKind, string> = {
    complex: 'complex plane',
    function2d: '2D function',
    geometry2d: 'geometry lab',
    primitive3d: '3D primitive',
    ratio: 'division ratio',
    scalar: 'scalar value',
    surface3d: 'surface function',
    vector: 'vector plane',
  }

  return labels[kind]
}

const formatRoot = (root: number) => (Math.abs(root) < 0.000001 ? '0' : formatValue(root))

const formatRootAnalysis = (analysis: RootAnalysis) => {
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

const getFunctionSymbol = (analysisMode: AnalysisMode) => {
  if (analysisMode === 'derivative') {
    return "f'(x)"
  }

  if (analysisMode === 'integral') {
    return 'F(x)'
  }

  return 'f(x)'
}

const getFunctionResultLabel = (analysisMode: AnalysisMode) => {
  if (analysisMode === 'derivative') {
    return 'derivative'
  }

  if (analysisMode === 'integral') {
    return 'antiderivative'
  }

  return 'function'
}

const getInspectedFunctionLabel = (analysisMode: AnalysisMode, x: number) => {
  const formattedX = formatValue(x)

  if (analysisMode === 'derivative') {
    return `f'(${formattedX})`
  }

  if (analysisMode === 'integral') {
    return `F(${formattedX})`
  }

  return `f(${formattedX})`
}

const makeAnalysis = (
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

const isDisplayMathKind = (kind: MathObjectKind) =>
  kind === 'function2d' ||
  kind === 'geometry2d' ||
  kind === 'primitive3d' ||
  kind === 'surface3d' ||
  kind === 'vector' ||
  kind === 'complex'

const evaluateMathAnalysis = (
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

const insertPercent = (expression: string) =>
  expression.replace(/(\d+\.?\d*)$/, (_, value) => String(Number(value) / 100))

const toggleSign = (expression: string) => {
  if (!expression.trim() || expression === '0') {
    return '-'
  }

  const match = expression.match(/(-?\d+\.?\d*)$/)
  if (!match || match.index === undefined) {
    return `-(${expression})`
  }

  const value = match[1]
  const nextValue = value.startsWith('-') ? value.slice(1) : `-${value}`
  return `${expression.slice(0, match.index)}${nextValue}`
}

const expressionEndsWithBinaryOperator = (expression: string) => /[+\-*/]$/.test(expression)

const currentNumberHasDecimal = (expression: string) => {
  const normalizedExpression = expandFormattedExponents(expression)
  const currentNumber = normalizedExpression.split(/[+\-*/^(),]/).at(-1) ?? ''
  return currentNumber.includes('.')
}

const appendToken = (expression: string, token: string) => {
  const currentExpression = expression.trim() || '0'
  const lastCharacter = currentExpression.at(-1) ?? ''
  const tokenIsBinaryOperator = ['+', '-', '*', '/'].includes(token)
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

  return `${currentExpression}${token}`
}

const shouldContinueEvaluatedResult = (token: string) =>
  ['+', '-', '*', '/', '^', '^2', '^3'].includes(token)

const GRAPH_SCALE = 0.55
const MAX_GRAPH_EXTENT = 50
const ORTHOGRAPHIC_HALF_HEIGHT = 5.4

const toGraphPoint = (x: number, y: number, minY = -8, maxY = 8) =>
  new THREE.Vector3(x * GRAPH_SCALE, clamp(y, minY, maxY) * GRAPH_SCALE, 0)

const getTickStep = (range: number) => {
  if (range <= 12) {
    return 1
  }

  if (range <= 28) {
    return 2
  }

  if (range <= 70) {
    return 5
  }

  return 10
}

const formatAxisValue = (value: number) =>
  Math.abs(value) < 0.000001 ? '0' : formatValue(value)

function MathViewport({
  analysisMode,
  angleMode,
  axisValuesVisible,
  expression,
  graphZoom,
  inspectX,
  mathAnalysis,
  numericValue,
  onInspectXChange,
  orbitEnabled,
  visualizationMode,
}: {
  analysisMode: AnalysisMode
  angleMode: AngleMode
  axisValuesVisible: boolean
  expression: string
  graphZoom: number
  inspectX: number
  mathAnalysis: MathAnalysis
  numericValue: number | null
  onInspectXChange: (value: number) => void
  orbitEnabled: boolean
  visualizationMode: VisualizationMode
}) {
  const mountRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) {
      return
    }

    const scene = new THREE.Scene()
    const use2D =
      mathAnalysis.kind === 'function2d' ||
      mathAnalysis.kind === 'geometry2d' ||
      mathAnalysis.kind === 'vector' ||
      mathAnalysis.kind === 'complex'
    const width = Math.max(mount.clientWidth, 1)
    const height = Math.max(mount.clientHeight, 1)
    const aspect = width / height
    const camera = use2D
      ? new THREE.OrthographicCamera(
          -ORTHOGRAPHIC_HALF_HEIGHT * aspect,
          ORTHOGRAPHIC_HALF_HEIGHT * aspect,
          ORTHOGRAPHIC_HALF_HEIGHT,
          -ORTHOGRAPHIC_HALF_HEIGHT,
          0.1,
          100,
        )
      : new THREE.PerspectiveCamera(45, aspect, 0.1, 100)
    if (camera instanceof THREE.OrthographicCamera) {
      camera.zoom = graphZoom
    }

    camera.position.set(0, use2D ? 0 : 3.2 / graphZoom, use2D ? 10 : 8 / graphZoom)
    camera.lookAt(0, 0, 0)
    camera.updateProjectionMatrix()

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(width, height)
    renderer.domElement.style.cursor = mathAnalysis.kind === 'function2d' ? 'crosshair' : 'default'
    mount.appendChild(renderer.domElement)

    const group = new THREE.Group()
    scene.add(group)

    scene.add(new THREE.AmbientLight(0xffffff, 1.7))
    const keyLight = new THREE.PointLight(0xffa238, 18, 30)
    keyLight.position.set(3, 5, 5)
    scene.add(keyLight)
    const rimLight = new THREE.PointLight(0x69d2ff, 14, 28)
    rimLight.position.set(-4, -2, 3)
    scene.add(rimLight)

    const line = (points: THREE.Vector3[], color: number, opacity = 1) => {
      const geometry = new THREE.BufferGeometry().setFromPoints(points)
      const material = new THREE.LineBasicMaterial({
        color,
        transparent: opacity < 1,
        opacity,
      })
      const mesh = new THREE.Line(geometry, material)
      group.add(mesh)
      return mesh
    }

    const meshBox = (
      width: number,
      height: number,
      depth: number,
      material: THREE.Material,
      position: THREE.Vector3,
    ) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material)
      mesh.position.copy(position)
      group.add(mesh)
      return mesh
    }

    const getVisibleMathBounds = () => {
      if (!(camera instanceof THREE.OrthographicCamera)) {
        return {
          maxX: 10,
          maxY: 8,
          minX: -10,
          minY: -8,
        }
      }

      const minX = clamp(camera.left / camera.zoom / GRAPH_SCALE, -MAX_GRAPH_EXTENT, MAX_GRAPH_EXTENT)
      const maxX = clamp(camera.right / camera.zoom / GRAPH_SCALE, -MAX_GRAPH_EXTENT, MAX_GRAPH_EXTENT)
      const minY = clamp(camera.bottom / camera.zoom / GRAPH_SCALE, -MAX_GRAPH_EXTENT, MAX_GRAPH_EXTENT)
      const maxY = clamp(camera.top / camera.zoom / GRAPH_SCALE, -MAX_GRAPH_EXTENT, MAX_GRAPH_EXTENT)

      return { maxX, maxY, minX, minY }
    }

    const makeTextSprite = (text: string, color = '#d7e6eb') => {
      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d')
      if (!context) {
        return null
      }

      const fontSize = 32
      context.font = `600 ${fontSize}px Inter, ui-sans-serif, system-ui, sans-serif`
      const metrics = context.measureText(text)
      const paddingX = 18
      const paddingY = 12
      canvas.width = Math.ceil(metrics.width + paddingX * 2)
      canvas.height = fontSize + paddingY * 2
      context.font = `600 ${fontSize}px Inter, ui-sans-serif, system-ui, sans-serif`
      context.textAlign = 'center'
      context.textBaseline = 'middle'
      context.fillStyle = color
      context.fillText(text, canvas.width / 2, canvas.height / 2)

      const texture = new THREE.CanvasTexture(canvas)
      texture.colorSpace = THREE.SRGBColorSpace
      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: texture,
          transparent: true,
          depthTest: false,
          opacity: 0.92,
        }),
      )
      const height = 0.34 / graphZoom
      sprite.scale.set((canvas.width / canvas.height) * height, height, 1)
      group.add(sprite)
      return sprite
    }

    const render2DGrid = () => {
      const bounds = getVisibleMathBounds()
      const xRange = bounds.maxX - bounds.minX
      const yRange = bounds.maxY - bounds.minY
      const tickStep = Math.max(getTickStep(Math.max(xRange, yRange)), 1)
      const firstXTick = Math.ceil(bounds.minX / tickStep) * tickStep
      const firstYTick = Math.ceil(bounds.minY / tickStep) * tickStep
      const axisY = clamp(0, bounds.minY, bounds.maxY)
      const axisX = clamp(0, bounds.minX, bounds.maxX)
      const labelOffset = 0.58 / graphZoom
      const gridColor = 0x14242b
      const majorGridColor = 0x284956
      const axisMaterial = new THREE.MeshBasicMaterial({
        color: 0xd7e6eb,
        transparent: true,
        opacity: 0.88,
      })
      const tickMaterial = new THREE.MeshBasicMaterial({
        color: 0xd7e6eb,
        transparent: true,
        opacity: 0.58,
      })
      const originMaterial = new THREE.MeshBasicMaterial({
        color: 0xfff2c9,
        transparent: true,
        opacity: 0.94,
      })

      for (let tick = firstXTick; tick <= bounds.maxX; tick += tickStep) {
        const x = tick * GRAPH_SCALE
        const isMajor = Math.abs(tick) % (tickStep * 2) === 0
        const color = isMajor ? majorGridColor : gridColor
        const opacity = isMajor ? 0.72 : 0.52
        line(
          [
            new THREE.Vector3(x, bounds.minY * GRAPH_SCALE, -0.02),
            new THREE.Vector3(x, bounds.maxY * GRAPH_SCALE, -0.02),
          ],
          color,
          opacity,
        )

        if (Math.abs(tick) > 0.000001) {
          const tickLength = isMajor ? 0.16 : 0.1
          meshBox(0.018 / graphZoom, tickLength / graphZoom, 0.02, tickMaterial, new THREE.Vector3(x, axisY * GRAPH_SCALE, 0.02))
        }

        if (axisValuesVisible && Math.abs(tick) > 0.000001) {
          const label = makeTextSprite(formatAxisValue(tick), '#d7e6eb')
          if (label) {
            label.position.set(x, (axisY - labelOffset) * GRAPH_SCALE, 0.08)
          }
        }
      }

      for (let tick = firstYTick; tick <= bounds.maxY; tick += tickStep) {
        const y = tick * GRAPH_SCALE
        const isMajor = Math.abs(tick) % (tickStep * 2) === 0
        const color = isMajor ? majorGridColor : gridColor
        const opacity = isMajor ? 0.72 : 0.52
        line(
          [
            new THREE.Vector3(bounds.minX * GRAPH_SCALE, y, -0.02),
            new THREE.Vector3(bounds.maxX * GRAPH_SCALE, y, -0.02),
          ],
          color,
          opacity,
        )

        if (Math.abs(tick) > 0.000001) {
          const tickLength = isMajor ? 0.16 : 0.1
          meshBox(tickLength / graphZoom, 0.018 / graphZoom, 0.02, tickMaterial, new THREE.Vector3(axisX * GRAPH_SCALE, y, 0.02))
        }

        if (axisValuesVisible && Math.abs(tick) > 0.000001) {
          const label = makeTextSprite(formatAxisValue(tick), '#d7e6eb')
          if (label) {
            label.position.set((axisX + labelOffset) * GRAPH_SCALE, y, 0.08)
          }
        }
      }

      meshBox(xRange * GRAPH_SCALE, 0.032 / graphZoom, 0.03, axisMaterial, new THREE.Vector3(0, axisY * GRAPH_SCALE, 0.025))
      meshBox(0.032 / graphZoom, yRange * GRAPH_SCALE, 0.03, axisMaterial, new THREE.Vector3(axisX * GRAPH_SCALE, 0, 0.025))

      const origin = new THREE.Mesh(new THREE.CircleGeometry(0.08, 28), originMaterial)
      origin.position.set(0, 0, 0.06)
      group.add(origin)

      if (axisValuesVisible) {
        const originLabel = makeTextSprite('0', '#fff2c9')
        if (originLabel) {
          originLabel.position.set((axisX + labelOffset) * GRAPH_SCALE, (axisY - labelOffset) * GRAPH_SCALE, 0.09)
        }
      }
    }

    const render3DReferenceFrame = () => {
      const grid = new THREE.GridHelper(12, 24, 0x315866, 0x14242b)
      grid.position.y = -2.2
      group.add(grid)

      const axes = new THREE.AxesHelper(3.4)
      axes.position.y = -2.2
      group.add(axes)

      if (axisValuesVisible) {
        const axisLabels: Array<[string, string, THREE.Vector3]> = [
          ['x=3', '#ffb1a8', new THREE.Vector3(3.55, -2.2, 0)],
          ['x=-3', '#ffb1a8', new THREE.Vector3(-3.55, -2.2, 0)],
          ['y=3', '#b4ffc9', new THREE.Vector3(0, 1.15, 0)],
          ['z=3', '#8fc8ff', new THREE.Vector3(0, -2.2, 3.55)],
          ['z=-3', '#8fc8ff', new THREE.Vector3(0, -2.2, -3.55)],
          ['0', '#fff2c9', new THREE.Vector3(0, -2.2, 0)],
        ]

        axisLabels.forEach(([label, color, position]) => {
          const sprite = makeTextSprite(label, color)
          if (sprite) {
            sprite.position.copy(position)
          }
        })
      }
    }

    if (mathAnalysis.kind === 'function2d') {
      render2DGrid()

      const bounds = getVisibleMathBounds()
      const sourceExpression = expression.trim() || '0'
      const activeExpression = mathAnalysis.activeExpression.trim() || sourceExpression
      const hasTransform = activeExpression !== sourceExpression
      const buildCurveSegments = (curveExpression: string) => {
        const segments: THREE.Vector3[][] = []
        let currentSegment: THREE.Vector3[] = []
        const finishSegment = () => {
          if (currentSegment.length > 1) {
            segments.push(currentSegment)
          }
          currentSegment = []
        }

        for (let index = 0; index <= 420; index += 1) {
          const x = bounds.minX + ((bounds.maxX - bounds.minX) * index) / 420
          const y = evaluateRawForPoint(curveExpression, angleMode, x)
          const yIsVisible = y !== null && y >= bounds.minY && y <= bounds.maxY

          if (yIsVisible) {
            currentSegment.push(toGraphPoint(x, y, bounds.minY, bounds.maxY))
          } else {
            finishSegment()
          }
        }

        finishSegment()
        return segments
      }

      if (hasTransform) {
        buildCurveSegments(sourceExpression).forEach((segment) => line(segment, 0x8f6f8e, 0.42))
      }

      const activeSegments = buildCurveSegments(activeExpression)
      const activePoints = activeSegments.flat()
      if (activeSegments.length > 0) {
        const activeYValues = activePoints.map((point) => point.y)
        const activeMinY = Math.min(...activeYValues)
        const activeMaxY = Math.max(...activeYValues)
        const isFlatActiveCurve = activeMaxY - activeMinY < 0.025
        if (isFlatActiveCurve) {
          meshBox(
            (bounds.maxX - bounds.minX) * GRAPH_SCALE,
            0.07 / graphZoom,
            0.035,
            new THREE.MeshBasicMaterial({
              color: 0x6ee7ff,
              transparent: true,
              opacity: 0.78,
            }),
            new THREE.Vector3(((bounds.minX + bounds.maxX) / 2) * GRAPH_SCALE, activePoints[0].y, 0.045),
          )
        }
        activeSegments.forEach((segment) => line(segment, 0x6ee7ff, 1))
      }

      const inspectedY = evaluateRawForPoint(activeExpression, angleMode, inspectX)
      if (inspectX >= bounds.minX && inspectX <= bounds.maxX) {
        line(
          [
            toGraphPoint(inspectX, bounds.minY, bounds.minY, bounds.maxY).setZ(0.01),
            toGraphPoint(inspectX, bounds.maxY, bounds.minY, bounds.maxY).setZ(0.01),
          ],
          0xfff2c9,
          0.28,
        )
      }

      if (
        inspectedY !== null &&
        inspectX >= bounds.minX &&
        inspectX <= bounds.maxX &&
        inspectedY >= bounds.minY &&
        inspectedY <= bounds.maxY
      ) {
        const inspectMarker = new THREE.Mesh(
          new THREE.CircleGeometry(0.13, 32),
          new THREE.MeshBasicMaterial({ color: 0xfff2c9 }),
        )
        inspectMarker.position.copy(toGraphPoint(inspectX, inspectedY, bounds.minY, bounds.maxY))
        inspectMarker.position.z = 0.07
        group.add(inspectMarker)
      }

      if (analysisMode === 'integral') {
        const areaPoints: THREE.Vector3[] = [toGraphPoint(-2, 0, bounds.minY, bounds.maxY)]
        for (let index = 0; index <= 120; index += 1) {
          const x = -2 + (4 * index) / 120
          const y = evaluateForPoint(sourceExpression, angleMode, x)
          areaPoints.push(toGraphPoint(x, y ?? 0, bounds.minY, bounds.maxY))
        }
        areaPoints.push(toGraphPoint(2, 0, bounds.minY, bounds.maxY))

        const shape = new THREE.Shape(areaPoints.map((point) => new THREE.Vector2(point.x, point.y)))
        const area = new THREE.Mesh(
          new THREE.ShapeGeometry(shape),
          new THREE.MeshBasicMaterial({
            color: 0xffa238,
            transparent: true,
            opacity: 0.24,
            side: THREE.DoubleSide,
          }),
        )
        area.position.z = -0.02
        group.add(area)
      }

      if (mathAnalysis.activeRootAnalysis.kind === 'roots') {
        mathAnalysis.activeRootAnalysis.roots
          .filter((root) => root >= bounds.minX && root <= bounds.maxX)
          .forEach((root) => {
            const marker = new THREE.Mesh(
              new THREE.CircleGeometry(0.13, 32),
              new THREE.MeshBasicMaterial({ color: 0xfff2c9 }),
            )
            marker.position.copy(toGraphPoint(root, 0, bounds.minY, bounds.maxY))
            marker.position.z = 0.06
            group.add(marker)
          })
      }
    } else if (mathAnalysis.kind === 'geometry2d') {
      render2DGrid()
      const bounds = getVisibleMathBounds()
      const geometry = mathAnalysis.geometry
      const geometryMaterial = new THREE.MeshBasicMaterial({
        color: 0x6ee7ff,
        transparent: true,
        opacity: 0.95,
      })
      const accentMaterial = new THREE.MeshBasicMaterial({
        color: 0xfff2c9,
        transparent: true,
        opacity: 0.95,
      })
      const fillMaterial = new THREE.MeshBasicMaterial({
        color: 0x6ee7ff,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.16,
      })
      const geometryPoint = (point: Point2D, z = 0.05) =>
        new THREE.Vector3(point.x * GRAPH_SCALE, point.y * GRAPH_SCALE, z)
      const drawPoint = (point: Point2D, label: string, material = accentMaterial) => {
        if (point.x < bounds.minX || point.x > bounds.maxX || point.y < bounds.minY || point.y > bounds.maxY) {
          return
        }

        const marker = new THREE.Mesh(new THREE.CircleGeometry(0.13 / graphZoom, 28), material)
        marker.position.copy(geometryPoint(point, 0.1))
        marker.position.z = 0.1
        group.add(marker)

        const text = makeTextSprite(label, '#fff2c9')
        if (text) {
          text.position.set((point.x + 0.38 / graphZoom) * GRAPH_SCALE, (point.y + 0.42 / graphZoom) * GRAPH_SCALE, 0.12)
        }
      }

      if (geometry?.kind === 'point') {
        drawPoint(geometry.point, 'P')
      } else if (geometry?.kind === 'segment') {
        line(
          [
            geometryPoint(geometry.a),
            geometryPoint(geometry.b),
          ],
          0x6ee7ff,
          1,
        )
        drawPoint(geometry.a, 'A')
        drawPoint(geometry.b, 'B')
        drawPoint(geometry.midpoint, 'M', geometryMaterial)
      } else if (geometry?.kind === 'circle') {
        const points: THREE.Vector3[] = []
        for (let index = 0; index <= 240; index += 1) {
          const theta = (Math.PI * 2 * index) / 240
          const x = geometry.center.x + Math.cos(theta) * geometry.radius
          const y = geometry.center.y + Math.sin(theta) * geometry.radius
          points.push(new THREE.Vector3(x * GRAPH_SCALE, y * GRAPH_SCALE, 0.05))
        }
        line(points, 0x6ee7ff, 1)
        line(
          [
            geometryPoint(geometry.center, 0.04),
            geometryPoint({ x: geometry.center.x + geometry.radius, y: geometry.center.y }, 0.04),
          ],
          0xfff2c9,
          0.78,
        )
        drawPoint(geometry.center, 'C')
      } else if (geometry?.kind === 'triangle') {
        const trianglePoints = geometry.points.map((point) =>
          geometryPoint(point),
        )
        const shape = new THREE.Shape(trianglePoints.map((point) => new THREE.Vector2(point.x, point.y)))
        const fill = new THREE.Mesh(new THREE.ShapeGeometry(shape), fillMaterial)
        fill.position.z = 0.03
        group.add(fill)
        line(
          [
            trianglePoints[0].clone().setZ(0.06),
            trianglePoints[1].clone().setZ(0.06),
            trianglePoints[2].clone().setZ(0.06),
            trianglePoints[0].clone().setZ(0.06),
          ],
          0x6ee7ff,
          1,
        )
        geometry.points.forEach((point, index) => drawPoint(point, String.fromCharCode(65 + index)))
        drawPoint(geometry.centroid, 'G', geometryMaterial)
      }
    } else if (mathAnalysis.kind === 'vector' || mathAnalysis.kind === 'complex') {
      render2DGrid()
      const vector =
        mathAnalysis.kind === 'vector'
          ? mathAnalysis.vector
          : mathAnalysis.complex && {
              angle: mathAnalysis.complex.angle,
              magnitude: mathAnalysis.complex.magnitude,
              x: mathAnalysis.complex.re,
              y: mathAnalysis.complex.im,
            }

      if (vector) {
        const end = toGraphPoint(vector.x, vector.y)
        const componentMaterial = new THREE.LineBasicMaterial({
          color: 0xffa238,
          transparent: true,
          opacity: 0.75,
        })
        group.add(
          new THREE.Line(
            new THREE.BufferGeometry().setFromPoints([
              new THREE.Vector3(end.x, 0, 0.01),
              new THREE.Vector3(end.x, end.y, 0.01),
              new THREE.Vector3(0, end.y, 0.01),
            ]),
            componentMaterial,
          ),
        )
        line([new THREE.Vector3(0, 0, 0.03), end.clone().setZ(0.03)], 0x6ee7ff, 1)

        const marker = new THREE.Mesh(
          new THREE.CircleGeometry(0.16, 32),
          new THREE.MeshBasicMaterial({ color: 0x6ee7ff }),
        )
        marker.position.copy(end)
        marker.position.z = 0.08
        group.add(marker)

        if (mathAnalysis.kind === 'complex') {
          const conjugate = toGraphPoint(vector.x, -vector.y)
          line([new THREE.Vector3(0, 0, 0.02), conjugate.clone().setZ(0.02)], 0xffa238, 0.75)
          const conjugateMarker = new THREE.Mesh(
            new THREE.CircleGeometry(0.11, 32),
            new THREE.MeshBasicMaterial({ color: 0xffa238 }),
          )
          conjugateMarker.position.copy(conjugate)
          conjugateMarker.position.z = 0.08
          group.add(conjugateMarker)
        }
      }
    } else if (mathAnalysis.kind === 'primitive3d') {
      render3DReferenceFrame()
      const primitive = mathAnalysis.primitive3d

      if (primitive) {
        const primitiveMaxDimension =
          primitive.kind === 'sphere'
            ? primitive.radius * 2
            : primitive.kind === 'cube'
              ? primitive.side
              : primitive.kind === 'cylinder' || primitive.kind === 'cone'
                ? Math.max(primitive.radius * 2, primitive.height)
                : primitive.kind === 'line3d'
                  ? primitive.length
                  : 7
        const primitiveScale = Math.min(1, 4 / Math.max(primitiveMaxDimension, 1))
        const toScenePoint3D = (point: Point3D) =>
          new THREE.Vector3(point.x * primitiveScale, point.y * primitiveScale, point.z * primitiveScale)
        const solidMaterial = new THREE.MeshStandardMaterial({
          color: 0x60e6ff,
          emissive: 0x0a4050,
          metalness: 0.18,
          roughness: 0.28,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.74,
        })
        const wireMaterial = new THREE.MeshBasicMaterial({
          color: 0xffa238,
          opacity: 0.24,
          transparent: true,
          wireframe: true,
        })
        const accentMaterial = new THREE.MeshStandardMaterial({
          color: 0xfff2c9,
          emissive: 0x493a14,
          metalness: 0.12,
          roughness: 0.24,
        })
        const addPrimitiveMesh = (
          geometry: THREE.BufferGeometry,
          position: THREE.Vector3,
          quaternion?: THREE.Quaternion,
          material = solidMaterial,
        ) => {
          const mesh = new THREE.Mesh(geometry, material)
          mesh.position.copy(position)
          if (quaternion) {
            mesh.quaternion.copy(quaternion)
          }
          group.add(mesh)

          const wire = new THREE.Mesh(geometry.clone(), wireMaterial)
          wire.position.copy(position)
          wire.quaternion.copy(mesh.quaternion)
          group.add(wire)
          return mesh
        }
        const addCenterMarker = (center: Point3D) => {
          const marker = new THREE.Mesh(new THREE.SphereGeometry(0.08, 24, 16), accentMaterial)
          marker.position.copy(toScenePoint3D(center))
          group.add(marker)
        }

        if (primitive.kind === 'sphere') {
          const center = toScenePoint3D(primitive.center)
          const radius = primitive.radius * primitiveScale
          addPrimitiveMesh(new THREE.SphereGeometry(radius, 48, 32), center)
          addCenterMarker(primitive.center)
          line([center, center.clone().add(new THREE.Vector3(radius, 0, 0))], 0xfff2c9, 0.82)
        } else if (primitive.kind === 'cube') {
          const side = primitive.side * primitiveScale
          addPrimitiveMesh(new THREE.BoxGeometry(side, side, side), toScenePoint3D(primitive.center))
          addCenterMarker(primitive.center)
        } else if (primitive.kind === 'cylinder') {
          const center = toScenePoint3D(primitive.center)
          const radius = primitive.radius * primitiveScale
          const height = primitive.height * primitiveScale
          addPrimitiveMesh(new THREE.CylinderGeometry(radius, radius, height, 64, 1, false), center)
          addCenterMarker(primitive.center)
          line(
            [
              center.clone().add(new THREE.Vector3(0, -height / 2, 0)),
              center.clone().add(new THREE.Vector3(0, height / 2, 0)),
            ],
            0xfff2c9,
            0.78,
          )
          line([center, center.clone().add(new THREE.Vector3(radius, 0, 0))], 0xfff2c9, 0.72)
        } else if (primitive.kind === 'cone') {
          const center = toScenePoint3D(primitive.center)
          const radius = primitive.radius * primitiveScale
          const height = primitive.height * primitiveScale
          addPrimitiveMesh(new THREE.ConeGeometry(radius, height, 64, 1, false), center)
          addCenterMarker(primitive.center)
          line(
            [
              center.clone().add(new THREE.Vector3(0, -height / 2, 0)),
              center.clone().add(new THREE.Vector3(0, height / 2, 0)),
            ],
            0xfff2c9,
            0.78,
          )
          line(
            [
              center.clone().add(new THREE.Vector3(0, height / 2, 0)),
              center.clone().add(new THREE.Vector3(radius, -height / 2, 0)),
            ],
            0xfff2c9,
            0.72,
          )
        } else if (primitive.kind === 'line3d') {
          const a = toScenePoint3D(primitive.a)
          const b = toScenePoint3D(primitive.b)
          const direction = b.clone().sub(a).normalize()
          const extension = Math.max(1, Math.min(2.5, primitive.length * primitiveScale))
          line(
            [
              a.clone().sub(direction.clone().multiplyScalar(extension)),
              b.clone().add(direction.clone().multiplyScalar(extension)),
            ],
            0x6ee7ff,
            1,
          )
          line([a, b], 0xfff2c9, 0.82)
          const markerA = new THREE.Mesh(new THREE.SphereGeometry(0.08, 24, 16), accentMaterial)
          markerA.position.copy(a)
          group.add(markerA)
          const markerB = new THREE.Mesh(new THREE.SphereGeometry(0.08, 24, 16), accentMaterial)
          markerB.position.copy(b)
          group.add(markerB)
        } else {
          const normal = new THREE.Vector3(primitive.normal.x, primitive.normal.y, primitive.normal.z)
          const normalLength = normal.length()
          const unitNormal = normal.clone().normalize()
          const position = unitNormal.clone().multiplyScalar((primitive.offset / normalLength) * primitiveScale)
          const quaternion = new THREE.Quaternion().setFromUnitVectors(
            new THREE.Vector3(0, 0, 1),
            unitNormal,
          )
          const planeMaterial = new THREE.MeshStandardMaterial({
            color: 0x60e6ff,
            emissive: 0x0a4050,
            metalness: 0.12,
            roughness: 0.34,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.34,
          })

          addPrimitiveMesh(new THREE.PlaneGeometry(7, 7, 12, 12), position, quaternion, planeMaterial)
          line([position, position.clone().add(unitNormal.multiplyScalar(1.5))], 0xfff2c9, 0.88)
        }
      }
    } else if (mathAnalysis.kind === 'surface3d') {
      const grid = new THREE.GridHelper(12, 24, 0x315866, 0x14242b)
      grid.position.y = -2.2
      group.add(grid)
      const axes = new THREE.AxesHelper(3.4)
      axes.position.y = -2.2
      group.add(axes)

      const expr = expression.trim() || '0'
      const size = 38
      const positions: number[] = []
      const indices: number[] = []

      for (let iy = 0; iy <= size; iy += 1) {
        for (let ix = 0; ix <= size; ix += 1) {
          const x = (ix / size - 0.5) * 8
          const y = (iy / size - 0.5) * 8
          const z = evaluateForPoint(expr, angleMode, x, y) ?? 0
          positions.push(x, z * 0.42, y)
        }
      }

      for (let iy = 0; iy < size; iy += 1) {
        for (let ix = 0; ix < size; ix += 1) {
          const a = iy * (size + 1) + ix
          const b = a + 1
          const c = a + size + 1
          const d = c + 1
          indices.push(a, c, b, b, c, d)
        }
      }

      const geometry = new THREE.BufferGeometry()
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
      geometry.setIndex(indices)
      geometry.computeVertexNormals()

      group.add(
        new THREE.Mesh(
          geometry,
          new THREE.MeshStandardMaterial({
            color: 0x60e6ff,
            emissive: 0x0a4050,
            metalness: 0.2,
            roughness: 0.26,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.72,
          }),
        ),
      )
      group.add(
        new THREE.Mesh(
          geometry,
          new THREE.MeshBasicMaterial({
            color: 0xffa238,
            opacity: 0.2,
            transparent: true,
            wireframe: true,
          }),
        ),
      )
    } else if (mathAnalysis.kind === 'ratio') {
      const divisionParts = parseSimpleDivision(expression)
      const grid = new THREE.GridHelper(12, 24, 0x315866, 0x14242b)
      grid.position.y = -2.2
      group.add(grid)

      if (divisionParts) {
        const barWidth = 5.4
        const segmentCount = clamp(Math.round(divisionParts.denominator), 2, 48)
        const filledSegments =
          divisionParts.remainder === null
            ? Math.round(divisionParts.fraction * segmentCount)
            : Math.round((divisionParts.remainder / divisionParts.denominator) * segmentCount)
        const fullMaterial = new THREE.MeshStandardMaterial({
          color: 0xffa238,
          emissive: 0x5f2600,
          metalness: 0.35,
          roughness: 0.28,
        })
        const fractionMaterial = new THREE.MeshStandardMaterial({
          color: 0x6ee7ff,
          emissive: 0x104a59,
          metalness: 0.2,
          roughness: 0.24,
        })
        const tickMaterial = new THREE.MeshBasicMaterial({
          color: 0xf4f8ff,
          opacity: 0.55,
          transparent: true,
        })

        for (let index = 0; index < Math.min(divisionParts.whole, 4); index += 1) {
          meshBox(barWidth, 0.34, 0.5, fullMaterial, new THREE.Vector3(0, 0.42 + index * 0.48, 0))
        }

        const fractionWidth = Math.max(barWidth * divisionParts.fraction, 0.04)
        meshBox(
          fractionWidth,
          0.34,
          0.5,
          fractionMaterial,
          new THREE.Vector3(-barWidth / 2 + fractionWidth / 2, -0.24, 0),
        )

        for (let index = 0; index <= segmentCount; index += 1) {
          const x = -barWidth / 2 + (index / segmentCount) * barWidth
          meshBox(0.018, index % 5 === 0 ? 0.5 : 0.32, 0.58, tickMaterial, new THREE.Vector3(x, -0.24, 0.05))
        }

        for (let index = 0; index < filledSegments; index += 1) {
          const segmentWidth = barWidth / segmentCount
          meshBox(
            segmentWidth * 0.72,
            0.08,
            0.68,
            fractionMaterial,
            new THREE.Vector3(-barWidth / 2 + segmentWidth * (index + 0.5), -0.74, 0.02),
          )
        }
      }
    } else {
      const scalar = Number.isFinite(numericValue ?? NaN) ? Number(numericValue) : 0
      const visibleValue = clamp(scalar, -10, 10)
      const scaleWidth = 6
      const scaleMaterial = new THREE.MeshBasicMaterial({
        color: 0xf4f8ff,
        opacity: 0.18,
        transparent: true,
      })
      const tickMaterial = new THREE.MeshBasicMaterial({
        color: 0xf4f8ff,
        opacity: 0.52,
        transparent: true,
      })
      const valueMaterial = new THREE.MeshStandardMaterial({
        color: scalar < 0 ? 0xffa238 : 0x6ee7ff,
        emissive: scalar < 0 ? 0x5f2600 : 0x104a59,
        metalness: 0.22,
        roughness: 0.28,
      })
      const zeroMaterial = new THREE.MeshStandardMaterial({
        color: 0xf4f8ff,
        emissive: 0x111820,
        metalness: 0.14,
        roughness: 0.32,
      })

      meshBox(scaleWidth, 0.04, 0.08, scaleMaterial, new THREE.Vector3(0, -0.4, 0))
      for (let tick = -10; tick <= 10; tick += 1) {
        meshBox(
          0.022,
          tick === 0 ? 0.76 : tick % 5 === 0 ? 0.46 : 0.28,
          0.1,
          tickMaterial,
          new THREE.Vector3((tick / 10) * (scaleWidth / 2), -0.4, 0.02),
        )
      }

      const valueX = (visibleValue / 10) * (scaleWidth / 2)
      const distance = Math.abs(valueX)
      if (distance > 0.025) {
        meshBox(distance, 0.22, 0.48, valueMaterial, new THREE.Vector3(valueX / 2, -0.05, 0))
      }

      const origin = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.08, 36), zeroMaterial)
      origin.rotation.x = Math.PI / 2
      origin.position.set(0, -0.4, 0.12)
      group.add(origin)

      const marker = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.14, 36), valueMaterial)
      marker.rotation.x = Math.PI / 2
      marker.position.set(valueX, 0.18, 0.12)
      marker.scale.x = scalar === 0 ? 0.78 : 1
      marker.scale.y = scalar === 0 ? 0.78 : 1
      group.add(marker)
    }

    const resizeObserver = new ResizeObserver(([entry]) => {
      const { width: nextWidth, height: nextHeight } = entry.contentRect
      renderer.setSize(nextWidth, nextHeight)

      if (camera instanceof THREE.PerspectiveCamera) {
        camera.aspect = nextWidth / Math.max(nextHeight, 1)
      } else {
        const nextAspect = nextWidth / Math.max(nextHeight, 1)
        camera.left = -ORTHOGRAPHIC_HALF_HEIGHT * nextAspect
        camera.right = ORTHOGRAPHIC_HALF_HEIGHT * nextAspect
        camera.top = ORTHOGRAPHIC_HALF_HEIGHT
        camera.bottom = -ORTHOGRAPHIC_HALF_HEIGHT
      }

      camera.updateProjectionMatrix()
    })
    resizeObserver.observe(mount)

    let isInspecting = false
    const setInspectXFromPointer = (event: PointerEvent) => {
      if (mathAnalysis.kind !== 'function2d' || !(camera instanceof THREE.OrthographicCamera)) {
        return
      }

      const rect = renderer.domElement.getBoundingClientRect()
      const bounds = getVisibleMathBounds()
      const percentX = clamp((event.clientX - rect.left) / Math.max(rect.width, 1), 0, 1)
      const nextX = Number((bounds.minX + percentX * (bounds.maxX - bounds.minX)).toFixed(2))
      onInspectXChange(nextX)
    }
    const handlePointerDown = (event: PointerEvent) => {
      isInspecting = true
      renderer.domElement.setPointerCapture(event.pointerId)
      setInspectXFromPointer(event)
    }
    const handlePointerMove = (event: PointerEvent) => {
      if (!isInspecting) {
        return
      }

      setInspectXFromPointer(event)
    }
    const handlePointerUp = (event: PointerEvent) => {
      isInspecting = false
      if (renderer.domElement.hasPointerCapture(event.pointerId)) {
        renderer.domElement.releasePointerCapture(event.pointerId)
      }
    }

    if (mathAnalysis.kind === 'function2d') {
      renderer.domElement.addEventListener('pointerdown', handlePointerDown)
      renderer.domElement.addEventListener('pointermove', handlePointerMove)
      renderer.domElement.addEventListener('pointerup', handlePointerUp)
      renderer.domElement.addEventListener('pointercancel', handlePointerUp)
    }

    let animationFrame = 0
    const animate = () => {
      animationFrame = requestAnimationFrame(animate)
      if (orbitEnabled && !use2D) {
        group.rotation.y += 0.003
        group.rotation.x = Math.sin(Date.now() * 0.00035) * 0.08
      }
      renderer.render(scene, camera)
    }
    animate()

    return () => {
      cancelAnimationFrame(animationFrame)
      resizeObserver.disconnect()
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown)
      renderer.domElement.removeEventListener('pointermove', handlePointerMove)
      renderer.domElement.removeEventListener('pointerup', handlePointerUp)
      renderer.domElement.removeEventListener('pointercancel', handlePointerUp)
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Line) {
          object.geometry.dispose()
          if (Array.isArray(object.material)) {
            object.material.forEach((material) => material.dispose())
          } else {
            object.material.dispose()
          }
        } else if (object instanceof THREE.Sprite) {
          object.material.map?.dispose()
          object.material.dispose()
        }
      })
      renderer.dispose()
      renderer.domElement.remove()
    }
  }, [
    analysisMode,
    angleMode,
    axisValuesVisible,
    expression,
    graphZoom,
    inspectX,
    mathAnalysis,
    numericValue,
    onInspectXChange,
    orbitEnabled,
    visualizationMode,
  ])

  return <div className="math-viewport" ref={mountRef} aria-label="Mathematical object visualization" />
}

function App() {
  const initialExpression = formatExpressionInput('x^2 - 4')
  const [expression, setExpression] = useState(initialExpression)
  const [committedExpression, setCommittedExpression] = useState(initialExpression)
  const [angleMode, setAngleMode] = useState<AngleMode>('rad')
  const [visualizationMode, setVisualizationMode] = useState<VisualizationMode>('auto')
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode>('function')
  const [axisValuesVisible, setAxisValuesVisible] = useState(true)
  const [graphZoom, setGraphZoom] = useState(1)
  const [inspectX, setInspectX] = useState(1)
  const [orbitEnabled, setOrbitEnabled] = useState(false)
  const [memory, setMemory] = useState(0)
  const [secondary, setSecondary] = useState(false)
  const [shiftSecondary, setShiftSecondary] = useState(false)
  const [lastActionWasEvaluation, setLastActionWasEvaluation] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [geometryComposerOpen, setGeometryComposerOpen] = useState(true)
  const [geometryComposerKind, setGeometryComposerKind] =
    useState<GeometryComposerKind>('circle')
  const [geometryComposerFields, setGeometryComposerFields] = useState<Record<string, string>>(
    () => geometryComposerDefaults.circle,
  )
  const [expressionFocused, setExpressionFocused] = useState(false)
  const expressionInputRef = useRef<HTMLInputElement | null>(null)
  const [history, setHistory] = useState<HistoryItem[]>([
    { expression: formatExpressionInput('x^2 - 4'), value: 'function' },
    { expression: 'sphere(r=3)', value: 'sphere' },
    { expression: '<3, 4>', value: 'vector' },
    { expression: '3 + 4i', value: 'complex' },
  ])

  const mathAnalysis = useMemo(
    () => makeAnalysis(committedExpression, angleMode, visualizationMode, analysisMode),
    [analysisMode, angleMode, committedExpression, visualizationMode],
  )

  const evaluated = useMemo(
    () => evaluateMathAnalysis(committedExpression, angleMode, mathAnalysis),
    [angleMode, committedExpression, mathAnalysis],
  )

  const isDisplayObject = isDisplayMathKind(mathAnalysis.kind)
  const hasPendingExpression = expression.trim() !== committedExpression.trim()

  const inspectedActiveValue = useMemo(
    () =>
      mathAnalysis.kind === 'function2d'
        ? evaluateRawForPoint(mathAnalysis.activeExpression, angleMode, inspectX)
        : null,
    [angleMode, inspectX, mathAnalysis.activeExpression, mathAnalysis.kind],
  )

  const inspectedSlope = useMemo(() => {
    if (mathAnalysis.kind !== 'function2d') {
      return null
    }

    return mathAnalysis.symbolicDerivative
      ? evaluateRawForPoint(mathAnalysis.symbolicDerivative, angleMode, inspectX)
      : derivativeAt(committedExpression, angleMode, inspectX)
  }, [angleMode, committedExpression, inspectX, mathAnalysis.kind, mathAnalysis.symbolicDerivative])

  const isConstantActiveFunction = useMemo(() => {
    if (mathAnalysis.kind !== 'function2d') {
      return false
    }

    const normalizedExpression = normalizeExpressionForMath(mathAnalysis.activeExpression)
    return !/\b[xt]\b/.test(normalizedExpression)
  }, [mathAnalysis.activeExpression, mathAnalysis.kind])

  const analysisRows = useMemo(() => {
    if (mathAnalysis.kind === 'function2d') {
      if (analysisMode === 'derivative') {
        return [
          ['source f(x)', displayExpression(committedExpression)],
          [
            "f'(x)",
            mathAnalysis.symbolicDerivative
              ? displayExpression(mathAnalysis.symbolicDerivative)
              : 'not available',
          ],
          ['shape', isConstantActiveFunction ? 'horizontal line' : 'curve'],
          ["roots of f'(x)", formatRootAnalysis(mathAnalysis.activeRootAnalysis)],
          [
            getInspectedFunctionLabel(analysisMode, inspectX),
            inspectedActiveValue === null ? 'not available' : formatValue(inspectedActiveValue),
          ],
        ]
      }

      if (analysisMode === 'integral') {
        return [
          ['source f(x)', displayExpression(committedExpression)],
          [
            'F(x)',
            mathAnalysis.symbolicIntegral
              ? displayExpression(mathAnalysis.symbolicIntegral)
              : 'not available',
          ],
          ['roots of F(x)', formatRootAnalysis(mathAnalysis.activeRootAnalysis)],
          [
            getInspectedFunctionLabel(analysisMode, inspectX),
            inspectedActiveValue === null ? 'not available' : formatValue(inspectedActiveValue),
          ],
          [
            'area [-2, 2]',
            mathAnalysis.integralArea === null ? 'not available' : formatValue(mathAnalysis.integralArea),
          ],
        ]
      }

      return [
        ['roots of f(x)', formatRootAnalysis(mathAnalysis.rootAnalysis)],
        ['y-intercept', mathAnalysis.yIntercept === null ? 'not available' : formatValue(mathAnalysis.yIntercept)],
        [
          getInspectedFunctionLabel(analysisMode, inspectX),
          inspectedActiveValue === null ? 'not available' : formatValue(inspectedActiveValue),
        ],
        [
          `f'(${formatValue(inspectX)})`,
          inspectedSlope === null ? 'not available' : formatValue(inspectedSlope),
        ],
        [
          'integral [-2, 2]',
          mathAnalysis.integralArea === null ? 'not available' : formatValue(mathAnalysis.integralArea),
        ],
      ]
    }

    if (mathAnalysis.kind === 'vector' && mathAnalysis.vector) {
      return [
        ['components', `<${formatValue(mathAnalysis.vector.x)}, ${formatValue(mathAnalysis.vector.y)}>`],
        ['magnitude', formatValue(mathAnalysis.vector.magnitude)],
        ['angle', `${formatValue(mathAnalysis.vector.angle)}°`],
      ]
    }

    if (mathAnalysis.kind === 'complex' && mathAnalysis.complex) {
      return [
        ['rectangular', `${formatValue(mathAnalysis.complex.re)} + ${formatValue(mathAnalysis.complex.im)}i`],
        ['modulus', formatValue(mathAnalysis.complex.magnitude)],
        ['argument', `${formatValue(mathAnalysis.complex.angle)}°`],
        ['conjugate', mathAnalysis.complex.conjugate],
      ]
    }

    if (mathAnalysis.kind === 'geometry2d' && mathAnalysis.geometry) {
      const geometry = mathAnalysis.geometry

      if (geometry.kind === 'point') {
        return [
          ['type', 'point'],
          ['coordinates', formatPoint(geometry.point)],
        ]
      }

      if (geometry.kind === 'segment') {
        return [
          ['type', 'segment'],
          ['length', formatValue(geometry.length)],
          ['midpoint', formatPoint(geometry.midpoint)],
          ['slope', geometry.slope === null ? 'vertical' : formatValue(geometry.slope)],
        ]
      }

      if (geometry.kind === 'circle') {
        return [
          ['type', 'circle'],
          ['center', formatPoint(geometry.center)],
          ['radius', formatValue(geometry.radius)],
          ['area', formatValue(geometry.area)],
          ['circumference', formatValue(geometry.circumference)],
        ]
      }

      return [
        ['type', 'triangle'],
        ['area', formatValue(geometry.area)],
        ['perimeter', formatValue(geometry.perimeter)],
        ['centroid', formatPoint(geometry.centroid)],
        ['side lengths', geometry.sides.map(formatValue).join(', ')],
      ]
    }

    if (mathAnalysis.kind === 'primitive3d' && mathAnalysis.primitive3d) {
      const primitive = mathAnalysis.primitive3d

      if (primitive.kind === 'sphere') {
        return [
          ['type', 'sphere'],
          ['center', formatPoint3D(primitive.center)],
          ['radius', formatValue(primitive.radius)],
          ['volume', formatValue(primitive.volume)],
          ['surface area', formatValue(primitive.surfaceArea)],
        ]
      }

      if (primitive.kind === 'cube') {
        return [
          ['type', 'cube'],
          ['center', formatPoint3D(primitive.center)],
          ['side', formatValue(primitive.side)],
          ['space diagonal', formatValue(primitive.diagonal)],
          ['volume', formatValue(primitive.volume)],
          ['surface area', formatValue(primitive.surfaceArea)],
        ]
      }

      if (primitive.kind === 'cylinder') {
        return [
          ['type', 'cylinder'],
          ['center', formatPoint3D(primitive.center)],
          ['radius', formatValue(primitive.radius)],
          ['height', formatValue(primitive.height)],
          ['volume', formatValue(primitive.volume)],
          ['surface area', formatValue(primitive.surfaceArea)],
        ]
      }

      if (primitive.kind === 'cone') {
        return [
          ['type', 'cone'],
          ['center', formatPoint3D(primitive.center)],
          ['radius', formatValue(primitive.radius)],
          ['height', formatValue(primitive.height)],
          ['slant height', formatValue(primitive.slantHeight)],
          ['volume', formatValue(primitive.volume)],
          ['surface area', formatValue(primitive.surfaceArea)],
        ]
      }

      if (primitive.kind === 'line3d') {
        return [
          ['type', 'line in 3D'],
          ['point A', formatPoint3D(primitive.a)],
          ['point B', formatPoint3D(primitive.b)],
          ['direction', formatPoint3D(primitive.direction)],
          ['distance A-B', formatValue(primitive.length)],
        ]
      }

      return [
        ['type', 'plane'],
        ['normal', formatPoint3D(primitive.normal)],
        ['offset', formatValue(primitive.offset)],
        ['distance from origin', formatValue(primitive.distanceFromOrigin)],
      ]
    }

    if (mathAnalysis.kind === 'ratio') {
      const ratio = parseSimpleDivision(committedExpression)
      return ratio
        ? [
            ['quotient', formatValue(ratio.value)],
            ['whole units', formatValue(ratio.whole)],
            ['remainder', ratio.remainder === null ? 'decimal remainder' : formatValue(ratio.remainder)],
          ]
        : []
    }

    return [['value', evaluated.valid ? evaluated.label : 'syntax']]
  }, [
    analysisMode,
    evaluated,
    committedExpression,
    inspectX,
    inspectedActiveValue,
    inspectedSlope,
    isConstantActiveFunction,
    mathAnalysis,
  ])

  const setFormattedExpression = (value: string) => {
    setExpression(value)
    setLastActionWasEvaluation(false)
  }

  const commitExpression = (
    value: string,
    options: {
      nextAnalysisMode?: AnalysisMode
      nextVisualizationMode?: VisualizationMode
    } = {},
  ) => {
    const nextExpression = value.trim() || '0'
    const nextAnalysisMode = options.nextAnalysisMode ?? analysisMode
    const nextVisualizationMode = options.nextVisualizationMode ?? visualizationMode

    if (options.nextAnalysisMode) {
      setAnalysisMode(options.nextAnalysisMode)
    }
    if (options.nextVisualizationMode) {
      setVisualizationMode(options.nextVisualizationMode)
    }

    const nextAnalysis = makeAnalysis(nextExpression, angleMode, nextVisualizationMode, nextAnalysisMode)
    const nextEvaluation = evaluateMathAnalysis(nextExpression, angleMode, nextAnalysis)
    setExpression(nextExpression)
    setCommittedExpression(nextExpression)
    setLastActionWasEvaluation(false)

    if (nextEvaluation.valid) {
      setHistory((items) =>
        [{ expression: nextExpression, value: nextEvaluation.label }, ...items].slice(0, 7),
      )
    }

    return nextEvaluation.valid
  }

  const draftGeometryExpression = (
    kind = geometryComposerKind,
    fields = geometryComposerFields,
  ) => {
    setFormattedExpression(buildGeometryExpression(kind, fields))
  }

  const commitGeometryExpression = () => {
    commitExpression(buildGeometryExpression(geometryComposerKind, geometryComposerFields), {
      nextAnalysisMode: 'function',
      nextVisualizationMode: 'auto',
    })
  }

  const selectGeometryObject = (kind: GeometryComposerKind) => {
    const fields = geometryComposerDefaults[kind]
    setGeometryComposerKind(kind)
    setGeometryComposerFields(fields)
    draftGeometryExpression(kind, fields)
  }

  const updateGeometryField = (key: string, value: string) => {
    const nextFields = { ...geometryComposerFields, [key]: value }
    setGeometryComposerFields(nextFields)
    if (geometryFieldsComplete(geometryComposerKind, nextFields)) {
      draftGeometryExpression(geometryComposerKind, nextFields)
    }
  }

  const generateGeometryExample = () => {
    const fields = randomGeometryFields(geometryComposerKind)
    setGeometryComposerFields(fields)
    draftGeometryExpression(geometryComposerKind, fields)
  }

  const handleExpressionChange = (event: ChangeEvent<HTMLInputElement>) => {
    const rawValue = event.target.value.replace(/^(-?)0+(?=\d)/, '$1')
    setExpression(rawValue)
    setLastActionWasEvaluation(false)
  }

  const updateInspectX = (value: number) => {
    if (!Number.isFinite(value)) {
      return
    }

    setInspectX(Number(clamp(value, -MAX_GRAPH_EXTENT, MAX_GRAPH_EXTENT).toFixed(2)))
  }

  const zoomGraph = (direction: 'in' | 'out') => {
    setGraphZoom((value) => {
      const factor = direction === 'in' ? 1.25 : 0.8
      return Number(clamp(value * factor, 0.5, 4).toFixed(2))
    })
  }

  const commitEvaluation = () => {
    const committed = commitExpression(expression)
    setLastActionWasEvaluation(committed)
  }

  const getAppendBaseExpression = (current: string, token: string) => {
    if (
      lastActionWasEvaluation &&
      shouldContinueEvaluatedResult(token) &&
      evaluated.numeric !== null &&
      Number.isFinite(evaluated.numeric)
    ) {
      return String(evaluated.numeric)
    }

    if (lastActionWasEvaluation && !shouldContinueEvaluatedResult(token)) {
      return '0'
    }

    return current
  }

  const handleInput = (token: string) => {
    switch (token) {
      case 'AC':
        setExpression('0')
        setCommittedExpression('0')
        setAnalysisMode('function')
        setVisualizationMode('auto')
        setOrbitEnabled(false)
        setLastActionWasEvaluation(false)
        return
      case 'backspace':
        setExpression((current) => (current.length <= 1 ? '0' : current.slice(0, -1)))
        setLastActionWasEvaluation(false)
        return
      case '=':
        commitEvaluation()
        return
      case 'Rad':
      case 'Deg':
        setAngleMode((mode) => (mode === 'rad' ? 'deg' : 'rad'))
        return
      case '2nd':
        setSecondary((value) => !value)
        return
      case 'mc':
        setMemory(0)
        return
      case 'm+':
        if (evaluated.numeric !== null && Number.isFinite(evaluated.numeric)) {
          const numeric = evaluated.numeric
          setMemory((value) => value + numeric)
        }
        return
      case 'm-':
        if (evaluated.numeric !== null && Number.isFinite(evaluated.numeric)) {
          const numeric = evaluated.numeric
          setMemory((value) => value - numeric)
        }
        return
      case 'mr':
        setExpression((current) =>
          appendToken(getAppendBaseExpression(current, String(memory)), String(memory)),
        )
        setLastActionWasEvaluation(false)
        return
      case '%':
        setExpression((current) => {
          const baseExpression =
            lastActionWasEvaluation && evaluated.numeric !== null && Number.isFinite(evaluated.numeric)
              ? String(evaluated.numeric)
              : current
          return insertPercent(baseExpression)
        })
        setLastActionWasEvaluation(false)
        return
      case '+/-':
        setExpression((current) => {
          const baseExpression =
            lastActionWasEvaluation && evaluated.numeric !== null && Number.isFinite(evaluated.numeric)
              ? String(evaluated.numeric)
              : current
          return toggleSign(baseExpression)
        })
        setLastActionWasEvaluation(false)
        return
      case 'Rand':
        setExpression((current) => appendToken(getAppendBaseExpression(current, 'rand()'), 'rand()'))
        setLastActionWasEvaluation(false)
        return
      case 'reciprocal':
        setExpression((current) => {
          const baseExpression =
            lastActionWasEvaluation && evaluated.numeric !== null && Number.isFinite(evaluated.numeric)
              ? String(evaluated.numeric)
              : current
          const normalized = baseExpression.trim()
          const nextExpression = normalized && normalized !== '0' ? `1/(${normalized})` : '1/('
          return nextExpression
        })
        setLastActionWasEvaluation(false)
        return
      case 'sample-function':
        commitExpression('x^2 - 4', { nextAnalysisMode: 'function', nextVisualizationMode: 'fx' })
        return
      case 'sample-derivative':
        commitExpression('x^3 - 3x', { nextAnalysisMode: 'derivative', nextVisualizationMode: 'fx' })
        return
      case 'sample-integral':
        commitExpression('sin(x)', { nextAnalysisMode: 'integral', nextVisualizationMode: 'fx' })
        return
      case 'sample-vector':
        commitExpression('<3, 4>', { nextAnalysisMode: 'function', nextVisualizationMode: 'auto' })
        return
      case 'sample-complex':
        commitExpression('3 + 4i', { nextAnalysisMode: 'function', nextVisualizationMode: 'auto' })
        return
      case 'sample-surface':
        commitExpression('sin(x) * cos(y)', { nextAnalysisMode: 'function', nextVisualizationMode: 'fxy' })
        return
      default:
        setExpression((current) =>
          appendToken(getAppendBaseExpression(current, token), token),
        )
        setLastActionWasEvaluation(false)
    }
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Shift') {
        setShiftSecondary(true)
        return
      }

      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLSelectElement
      ) {
        return
      }

      const keyMap: Record<string, string> = {
        Enter: '=',
        Escape: 'AC',
        Backspace: 'backspace',
        '^': '^',
        '*': '*',
        '/': '/',
        '+': '+',
        '-': '-',
        '.': '.',
        '<': '<',
        '>': '>',
        ',': ',',
        '(': '(',
        ')': ')',
        i: 'i',
        x: 'x',
        y: 'y',
      }

      if (/\d/.test(event.key)) {
        handleInput(event.key)
        return
      }

      const mapped = keyMap[event.key]
      if (mapped) {
        event.preventDefault()
        handleInput(mapped)
      }
    }
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key === 'Shift') {
        setShiftSecondary(false)
      }
    }
    const onWindowBlur = () => setShiftSecondary(false)

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onWindowBlur)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onWindowBlur)
    }
  })

  const secondaryActive = secondary || shiftSecondary
  const keys = [
    ['(', ')', 'mc', 'm+', 'm-', 'mr', 'backspace', 'AC', '%', '/'],
    ['2nd', '^2', '^3', '^', 'e^', '10^', '7', '8', '9', '*'],
    ['reciprocal', 'sqrt(', 'cbrt(', 'nthRoot(', 'ln(', 'log10(', '4', '5', '6', '-'],
    ['!', secondaryActive ? 'asin(' : 'sin(', secondaryActive ? 'acos(' : 'cos(', secondaryActive ? 'atan(' : 'tan(', 'e', '*10^', '1', '2', '3', '+'],
    ['Rand', 'sinh(', 'cosh(', 'tanh(', 'pi', angleMode === 'rad' ? 'Rad' : 'Deg', '+/-', '0', '.', '='],
  ]
  const objectKeys = ['x', 'y', 'i', 'log2(', '<', ',', '>']

  const labelForKey = (key: string) => {
    const labels: Record<string, string> = {
      backspace: '',
      '/': '÷',
      '*': '×',
      '-': '−',
      '+': '+',
      '^2': 'x²',
      '^3': 'x³',
      '^': 'xʸ',
      '10^': '10ˣ',
      'e^': 'eˣ',
      reciprocal: '1/x',
      'sqrt(': '²√x',
      'cbrt(': '³√x',
      'nthRoot(': 'ʸ√x',
      'ln(': 'ln',
      'log10(': 'log₁₀',
      'log2(': 'log₂',
      '!': 'x!',
      'sin(': secondaryActive ? 'sin⁻¹' : 'sin',
      'cos(': secondaryActive ? 'cos⁻¹' : 'cos',
      'tan(': secondaryActive ? 'tan⁻¹' : 'tan',
      'asin(': 'sin⁻¹',
      'acos(': 'cos⁻¹',
      'atan(': 'tan⁻¹',
      e: 'e',
      pi: 'π',
      '*10^': 'EE',
      'sinh(': 'sinh',
      'cosh(': 'cosh',
      'tanh(': 'tanh',
    }

    return labels[key] ?? key
  }

  const keyClass = (key: string) => {
    if (['/', '*', '-', '+', '='].includes(key)) {
      return 'operator'
    }
    if (['AC', '%', 'backspace'].includes(key)) {
      return 'utility'
    }
    if (/^\d$/.test(key) || key === '.') {
      return 'number'
    }
    if (key === '2nd' && secondaryActive) {
      return 'mode active'
    }
    if (key === 'Rad' || key === 'Deg') {
      return 'mode'
    }
    return 'scientific'
  }

  const keyArea = (key: string) => {
    const areas: Record<string, string> = {
      '!': 'factorial',
      '%': 'percent',
      '*': 'multiply',
      '*10^': 'ee',
      '+': 'add',
      '+/-': 'sign',
      ',': 'comma',
      '-': 'subtract',
      '.': 'decimal',
      '/': 'divide',
      '(': 'lparen',
      ')': 'rparen',
      '0': 'zero',
      '1': 'one',
      '2': 'two',
      '2nd': 'second',
      '3': 'three',
      '4': 'four',
      '5': 'five',
      '6': 'six',
      '7': 'seven',
      '8': 'eight',
      '9': 'nine',
      '10^': 'ten-power',
      '<': 'less',
      '=': 'equals',
      '>': 'greater',
      AC: 'clear',
      Deg: 'angle',
      Rad: 'angle',
      Rand: 'rand',
      'acos(': 'cos',
      'asin(': 'sin',
      'atan(': 'tan',
      backspace: 'backspace',
      'cbrt(': 'cube-root',
      'cos(': 'cos',
      'cosh(': 'cosh',
      e: 'econst',
      'e^': 'exp',
      i: 'imaginary',
      'ln(': 'ln',
      'log2(': 'log2',
      'log10(': 'log10',
      m: 'memory',
      'm+': 'memory-add',
      'm-': 'memory-subtract',
      mc: 'memory-clear',
      mr: 'memory-recall',
      pi: 'pi',
      reciprocal: 'reciprocal',
      'sin(': 'sin',
      'sinh(': 'sinh',
      'sqrt(': 'sqrt',
      'nthRoot(': 'nth-root',
      'tan(': 'tan',
      'tanh(': 'tanh',
      x: 'xvar',
      y: 'yvar',
      '^': 'power',
      '^2': 'power-two',
      '^3': 'power-three',
    }

    return areas[key] ?? key
  }

  const hasViewportControls =
    mathAnalysis.kind === 'function2d' ||
    mathAnalysis.kind === 'geometry2d' ||
    mathAnalysis.kind === 'primitive3d' ||
    mathAnalysis.kind === 'surface3d' ||
    mathAnalysis.kind === 'vector' ||
    mathAnalysis.kind === 'complex'
  const functionSymbol = getFunctionSymbol(analysisMode)
  const activeFunctionExpression =
    mathAnalysis.kind === 'function2d' ? mathAnalysis.activeExpression : committedExpression
  const inspectedFunctionLabel =
    mathAnalysis.kind === 'function2d' ? getInspectedFunctionLabel(analysisMode, inspectX) : ''
  const geometryViewportRows =
    mathAnalysis.kind === 'geometry2d'
      ? analysisRows.slice(1, 4)
      : mathAnalysis.kind === 'primitive3d'
        ? analysisRows.slice(1, 5)
        : []
  const activeTransformExpression =
    analysisMode === 'derivative'
      ? mathAnalysis.symbolicDerivative
      : analysisMode === 'integral'
        ? mathAnalysis.symbolicIntegral
        : null
  const resultLabel =
    hasPendingExpression
      ? 'press = to evaluate'
      : mathAnalysis.kind === 'function2d'
        ? getFunctionResultLabel(analysisMode)
        : evaluated.label
  const showViewportReadout = mathAnalysis.kind !== 'primitive3d'
  const geometryObjectChoices: Array<{
    icon: ReactNode
    kind: GeometryComposerKind
  }> = [
    { icon: <CircleDot size={15} />, kind: 'point' },
    { icon: <Spline size={15} />, kind: 'segment' },
    { icon: <Circle size={15} />, kind: 'circle' },
    { icon: <Triangle size={15} />, kind: 'triangle' },
    { icon: <Spline size={15} />, kind: 'line3d' },
    { icon: <Box size={15} />, kind: 'sphere' },
    { icon: <Cuboid size={15} />, kind: 'cube' },
    { icon: <Cylinder size={15} />, kind: 'cylinder' },
    { icon: <Cone size={15} />, kind: 'cone' },
    { icon: <Square size={15} />, kind: 'plane' },
  ]
  const geometryComposerFieldsForKind = geometryComposerConfig[geometryComposerKind].fields

  return (
    <main className="app-shell">
      <section className="hyper-window" aria-label="Hypercalculator">
        <header className="window-bar">
          <div className="window-title">
            <Sparkles size={16} />
            <span>Hypercalculator</span>
          </div>
        </header>

        <div className="workspace">
          <section className="visual-panel">
            <MathViewport
              analysisMode={analysisMode}
              angleMode={angleMode}
              axisValuesVisible={axisValuesVisible}
              expression={committedExpression}
              graphZoom={graphZoom}
              inspectX={inspectX}
              mathAnalysis={mathAnalysis}
              numericValue={evaluated.numeric}
              onInspectXChange={updateInspectX}
              orbitEnabled={orbitEnabled}
              visualizationMode={visualizationMode}
            />
            {hasViewportControls && (
              <div className="viewport-controls" aria-label="Graph display controls">
                <button
                  className={axisValuesVisible ? 'active' : undefined}
                  onClick={() => setAxisValuesVisible((visible) => !visible)}
                  title="Toggle axis values"
                  type="button"
                >
                  <Hash size={15} />
                  <span>values</span>
                </button>
                <button
                  aria-label="Zoom graph out"
                  onClick={() => zoomGraph('out')}
                  title="Zoom out"
                  type="button"
                >
                  <ZoomOut size={15} />
                </button>
                <button
                  aria-label="Reset graph zoom"
                  onClick={() => setGraphZoom(1)}
                  title="Reset zoom"
                  type="button"
                >
                  {Math.round(graphZoom * 100)}%
                </button>
                <button
                  aria-label="Zoom graph in"
                  onClick={() => zoomGraph('in')}
                  title="Zoom in"
                  type="button"
                >
                  <ZoomIn size={15} />
                </button>
              </div>
            )}
            {showViewportReadout && (
              <div className="viewport-readout">
                <span>
                  {mathAnalysis.kind === 'function2d'
                    ? getFunctionResultLabel(analysisMode)
                    : getViewportModeLabel(mathAnalysis.kind)}
                </span>
                <strong>{displayExpression(activeFunctionExpression) || '0'}</strong>
              </div>
            )}
            {mathAnalysis.kind === 'function2d' && (
              <div className="viewport-inspector">
                <span>inspect x</span>
                <strong>{formatValue(inspectX)}</strong>
                <span>{inspectedFunctionLabel}</span>
                <strong>{inspectedActiveValue === null ? 'not available' : formatValue(inspectedActiveValue)}</strong>
                {isConstantActiveFunction && (
                  <>
                    <span>shape</span>
                    <strong>horizontal line</strong>
                  </>
                )}
              </div>
            )}
            {geometryViewportRows.length > 0 && (
              <div className="viewport-inspector">
                {geometryViewportRows.map(([label, value]) => (
                  <span className="viewport-inspector-row" key={label}>
                    <span>{label}</span>
                    <strong>{value}</strong>
                  </span>
                ))}
              </div>
            )}
          </section>
        </div>

        <section className="calculator-deck">
          <div className={`display-strip ${isDisplayObject || hasPendingExpression ? 'function-display' : ''}`}>
            <div
              className={`expression-editor ${expressionFocused ? 'editing' : 'rendered'}`}
              onClick={() => expressionInputRef.current?.focus()}
            >
              <input
                aria-label="Expression"
                className="expression-input"
                onBlur={() => setExpressionFocused(false)}
                onChange={handleExpressionChange}
                onFocus={() => setExpressionFocused(true)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    commitEvaluation()
                  }
                }}
                ref={expressionInputRef}
                spellCheck={false}
                value={expression}
              />
              <div className="expression-render" aria-hidden="true">
                {renderMathExpression(expression)}
              </div>
            </div>
            {mathAnalysis.kind === 'function2d' && analysisMode !== 'function' && (
              <div className={`transform-line ${activeTransformExpression ? '' : 'unavailable'}`}>
                <span>{functionSymbol} =</span>
                <strong>
                  {activeTransformExpression ? displayExpression(activeTransformExpression) : 'not available'}
                </strong>
              </div>
            )}
            {mathAnalysis.kind === 'function2d' && (
              <div className={`solution-line ${mathAnalysis.activeRootAnalysis.kind}`}>
                <span>solve {functionSymbol}=0</span>
                <strong>{formatRootAnalysis(mathAnalysis.activeRootAnalysis)}</strong>
              </div>
            )}
            <div className={evaluated.valid || hasPendingExpression ? 'result-line' : 'result-line error'}>
              {resultLabel}
            </div>
          </div>

          {geometryComposerOpen && (
            <div className="geometry-composer" aria-label="Geometry composer">
              <div className="geometry-kind-strip" role="tablist" aria-label="Geometry object types">
                {geometryObjectChoices.map(({ icon, kind }) => {
                  const config = geometryComposerConfig[kind]

                  return (
                    <button
                      aria-selected={geometryComposerKind === kind}
                      className={geometryComposerKind === kind ? 'active' : undefined}
                      key={kind}
                      onClick={() => selectGeometryObject(kind)}
                      role="tab"
                      type="button"
                    >
                      {icon}
                      <span>{config.label}</span>
                      <small>{config.dimension.toUpperCase()}</small>
                    </button>
                  )
                })}
              </div>

              <div className="geometry-field-grid">
                {geometryComposerFieldsForKind.map((field) => (
                  <label key={field.key}>
                    <span>{field.label}</span>
                    <input
                      inputMode="text"
                      onChange={(event) => updateGeometryField(field.key, event.target.value)}
                      spellCheck={false}
                      value={geometryComposerFields[field.key] ?? ''}
                    />
                  </label>
                ))}
              </div>

              <div className="geometry-actions">
                <button onClick={commitGeometryExpression} type="button">
                  <WandSparkles size={15} />
                  <span>create</span>
                </button>
                <button onClick={generateGeometryExample} type="button">
                  <Dices size={15} />
                  <span>example</span>
                </button>
              </div>
            </div>
          )}

          <div className="status-strip">
            <span>{angleMode.toUpperCase()}</span>
            <span>MEM {formatValue(memory)}</span>
            <button
              className={geometryComposerOpen ? 'active' : undefined}
              onClick={() => setGeometryComposerOpen((open) => !open)}
              type="button"
            >
              <Shapes size={15} />
              <span>geometry</span>
            </button>
            <button
              className={visualizationMode === 'fx' && analysisMode === 'function' ? 'active' : undefined}
              onClick={() => {
                setVisualizationMode((mode) => (mode === 'fx' ? 'auto' : 'fx'))
                setAnalysisMode('function')
              }}
              type="button"
            >
              f(x)
            </button>
            <button
              className={analysisMode === 'derivative' ? 'active' : undefined}
              onClick={() => {
                setVisualizationMode('fx')
                setAnalysisMode('derivative')
              }}
              type="button"
            >
              f′(x)
            </button>
            <button
              className={analysisMode === 'integral' ? 'active' : undefined}
              onClick={() => {
                setVisualizationMode('fx')
                setAnalysisMode('integral')
              }}
              type="button"
            >
              ∫f
            </button>
            <button
              className={visualizationMode === 'fxy' ? 'active' : undefined}
              onClick={() => {
                setVisualizationMode((mode) => (mode === 'fxy' ? 'auto' : 'fxy'))
                setAnalysisMode('function')
              }}
              type="button"
            >
              f(x,y)
            </button>
            <button
              className={orbitEnabled ? 'active' : undefined}
              onClick={() => setOrbitEnabled((value) => !value)}
              type="button"
            >
              orbit
            </button>
            <button
              className={historyOpen ? 'active' : undefined}
              onClick={() => setHistoryOpen((open) => !open)}
              type="button"
            >
              <History size={15} />
              <span>history</span>
            </button>
            <button type="button" onClick={() => setFormattedExpression('0')} aria-label="Clear expression">
              <RotateCcw size={15} />
            </button>
          </div>

          {historyOpen && (
            <div className="history-drawer">
              {history.map((item, index) => (
                <button
                  type="button"
                  key={`${item.expression}-${index}`}
                  onClick={() => {
                    commitExpression(item.expression)
                    setHistoryOpen(false)
                  }}
                >
                  <span>{displayExpression(item.expression)}</span>
                  <strong>{item.value}</strong>
                </button>
              ))}
            </div>
          )}

          <div className="object-key-strip" aria-label="Math object keys">
            {objectKeys.map((key) => (
              <button
                aria-label={labelForKey(key)}
                className={`calc-key ${keyClass(key)}`}
                data-key-area={keyArea(key)}
                key={key}
                onClick={() => handleInput(key)}
                type="button"
              >
                {labelForKey(key)}
              </button>
            ))}
          </div>

          <div className="keypad" aria-label="Calculator keypad">
            {keys.flat().map((key) => (
              <button
                aria-label={key === 'backspace' ? 'Backspace' : labelForKey(key)}
                className={`calc-key ${keyClass(key)}`}
                data-key-area={keyArea(key)}
                key={key}
                onClick={() => handleInput(key)}
                type="button"
              >
                {key === 'backspace' ? <Delete size={27} /> : labelForKey(key)}
              </button>
            ))}
          </div>
        </section>
      </section>
    </main>
  )
}

export default App
