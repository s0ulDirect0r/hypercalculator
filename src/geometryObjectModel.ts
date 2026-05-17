export type NumericEvaluator = (expression: string) => number | null

export type Point2D = {
  x: number
  y: number
}

export type Point3D = {
  x: number
  y: number
  z: number
}

export type Geometry2DObject =
  | {
      kind: 'circle'
      area: number
      center: Point2D
      circumference: number
      radius: number
    }
  | {
      kind: 'hyperbola'
      a: number
      asymptoteSlopes: [number, number]
      b: number
      c: number
      center: Point2D
      eccentricity: number
      foci: [Point2D, Point2D]
      transverseAxis: 'x' | 'y'
      vertices: [Point2D, Point2D]
    }
  | {
      kind: 'point'
      point: Point2D
    }
  | {
      kind: 'segment'
      a: Point2D
      b: Point2D
      length: number
      midpoint: Point2D
      slope: number | null
    }
  | {
      kind: 'triangle'
      area: number
      centroid: Point2D
      perimeter: number
      points: [Point2D, Point2D, Point2D]
      sides: [number, number, number]
    }

export type Primitive3DObject =
  | {
      kind: 'cone'
      center: Point3D
      height: number
      radius: number
      slantHeight: number
      surfaceArea: number
      volume: number
    }
  | {
      kind: 'cube'
      center: Point3D
      diagonal: number
      side: number
      surfaceArea: number
      volume: number
    }
  | {
      kind: 'cylinder'
      center: Point3D
      height: number
      radius: number
      surfaceArea: number
      volume: number
    }
  | {
      kind: 'line3d'
      a: Point3D
      b: Point3D
      direction: Point3D
      length: number
    }
  | {
      kind: 'plane'
      distanceFromOrigin: number
      normal: Point3D
      offset: number
    }
  | {
      kind: 'sphere'
      center: Point3D
      diameter: number
      radius: number
      surfaceArea: number
      volume: number
    }

export type GeometryObject =
  | {
      dimension: '2d'
      object: Geometry2DObject
    }
  | {
      dimension: '3d'
      object: Primitive3DObject
    }

export const splitTopLevelCommas = (value: string) => {
  let depth = 0
  const parts: string[] = []
  let start = 0

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index]
    if (char === '(' || char === '[' || char === '<') {
      depth += 1
    } else if (char === ')' || char === ']' || char === '>') {
      depth -= 1
    } else if (char === ',' && depth === 0) {
      parts.push(value.slice(start, index).trim())
      start = index + 1
    }
  }

  parts.push(value.slice(start).trim())
  return parts.filter(Boolean)
}

export const splitTopLevelComma = (value: string) => {
  const parts = splitTopLevelCommas(value)
  return parts.length >= 2 ? [parts[0], parts.slice(1).join(',')] : null
}

export const distanceBetween = (a: Point2D, b: Point2D) => Math.hypot(b.x - a.x, b.y - a.y)

export const distanceBetween3D = (a: Point3D, b: Point3D) =>
  Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z)

export const midpointBetween = (a: Point2D, b: Point2D) => ({
  x: (a.x + b.x) / 2,
  y: (a.y + b.y) / 2,
})

const parseCall = (expression: string) => {
  const trimmed = expression.trim()
  const call = trimmed.match(/^([A-Za-z][A-Za-z0-9]*)\((.*)\)$/)
  if (!call) {
    return null
  }

  return {
    name: call[1].toLowerCase(),
    parts: splitTopLevelCommas(call[2]),
  }
}

const parseNamedArguments = (parts: string[]) => {
  const named: Record<string, string> = {}
  const positional: string[] = []

  parts.forEach((part) => {
    const match = part.match(/^([A-Za-z][A-Za-z0-9_]*)\s*=\s*(.+)$/)
    if (match) {
      named[match[1].toLowerCase()] = match[2].trim()
    } else {
      positional.push(part)
    }
  })

  return { named, positional }
}

const getNamedArgument = (named: Record<string, string>, names: string[]) =>
  names.map((name) => named[name]).find((value) => value !== undefined)

const readNumericArgument = (
  named: Record<string, string>,
  positional: string[],
  names: string[],
  position: number,
  evaluateNumeric: NumericEvaluator,
) => {
  const source = getNamedArgument(named, names) ?? positional[position]
  return source === undefined ? null : evaluateNumeric(source)
}

export const parsePoint2D = (value: string, evaluateNumeric: NumericEvaluator): Point2D | null => {
  const trimmed = value.trim()
  const match = trimmed.match(/^\((.*)\)$/) ?? trimmed.match(/^\[(.*)\]$/)
  if (!match) {
    return null
  }

  const parts = splitTopLevelCommas(match[1])
  if (parts.length !== 2) {
    return null
  }

  const x = evaluateNumeric(parts[0])
  const y = evaluateNumeric(parts[1])
  if (x === null || y === null) {
    return null
  }

  return { x, y }
}

export const parsePoint3D = (value: string, evaluateNumeric: NumericEvaluator): Point3D | null => {
  const trimmed = value.trim()
  const match = trimmed.match(/^\((.*)\)$/) ?? trimmed.match(/^\[(.*)\]$/)
  if (!match) {
    return null
  }

  const parts = splitTopLevelCommas(match[1])
  if (parts.length !== 3) {
    return null
  }

  const x = evaluateNumeric(parts[0])
  const y = evaluateNumeric(parts[1])
  const z = evaluateNumeric(parts[2])
  if (x === null || y === null || z === null) {
    return null
  }

  return { x, y, z }
}

const readPoint2DArgument = (
  named: Record<string, string>,
  positional: string[],
  names: string[],
  position: number,
  evaluateNumeric: NumericEvaluator,
) => {
  const source = getNamedArgument(named, names) ?? positional[position]
  return source === undefined ? null : parsePoint2D(source, evaluateNumeric)
}

const readPoint3DArgument = (
  named: Record<string, string>,
  positional: string[],
  names: string[],
  position: number,
  evaluateNumeric: NumericEvaluator,
) => {
  const source = getNamedArgument(named, names) ?? positional[position]
  return source === undefined ? null : parsePoint3D(source, evaluateNumeric)
}

export const parseGeometry2DObject = (
  expression: string,
  evaluateNumeric: NumericEvaluator,
): Geometry2DObject | null => {
  const call = parseCall(expression)
  if (!call) {
    return null
  }

  const { name, parts } = call
  const { named, positional } = parseNamedArguments(parts)

  if (name === 'point' || name === 'pt') {
    const x = readNumericArgument(named, positional, ['x'], 0, evaluateNumeric)
    const y = readNumericArgument(named, positional, ['y'], 1, evaluateNumeric)
    const point =
      readPoint2DArgument(named, positional, ['point', 'p'], 0, evaluateNumeric) ??
      (x !== null && y !== null ? { x, y } : null)

    return point ? { kind: 'point', point } : null
  }

  if (name === 'circle') {
    const positionalCenter = positional[0] ? parsePoint2D(positional[0], evaluateNumeric) : null
    const center =
      readPoint2DArgument(named, positional, ['center', 'c'], 0, evaluateNumeric) ??
      positionalCenter
    const firstNumericPosition = positionalCenter ? 1 : 0
    const radius = readNumericArgument(named, positional, ['r', 'radius'], firstNumericPosition, evaluateNumeric)

    if (!center || radius === null || radius <= 0) {
      return null
    }

    return {
      area: Math.PI * radius * radius,
      center,
      circumference: Math.PI * radius * 2,
      kind: 'circle',
      radius,
    }
  }

  if (name === 'hyperbola') {
    const positionalCenter = positional[0] ? parsePoint2D(positional[0], evaluateNumeric) : null
    const center =
      readPoint2DArgument(named, positional, ['center', 'c'], 0, evaluateNumeric) ??
      positionalCenter ??
      { x: 0, y: 0 }
    const firstNumericPosition = positionalCenter ? 1 : 0
    const a = readNumericArgument(named, positional, ['a', 'semimajor', 'semi_transverse'], firstNumericPosition, evaluateNumeric)
    const b = readNumericArgument(named, positional, ['b', 'semiminor', 'semi_conjugate'], firstNumericPosition + 1, evaluateNumeric)
    const axisSource = (getNamedArgument(named, ['axis', 'transverse', 'orientation']) ?? positional[firstNumericPosition + 2] ?? 'x')
      .trim()
      .toLowerCase()
    const transverseAxis = axisSource.startsWith('y') || axisSource.includes('vertical') ? 'y' : 'x'

    if (a === null || b === null || a <= 0 || b <= 0) {
      return null
    }

    const c = Math.hypot(a, b)
    const vertices: [Point2D, Point2D] =
      transverseAxis === 'x'
        ? [
            { x: center.x - a, y: center.y },
            { x: center.x + a, y: center.y },
          ]
        : [
            { x: center.x, y: center.y - a },
            { x: center.x, y: center.y + a },
          ]
    const foci: [Point2D, Point2D] =
      transverseAxis === 'x'
        ? [
            { x: center.x - c, y: center.y },
            { x: center.x + c, y: center.y },
          ]
        : [
            { x: center.x, y: center.y - c },
            { x: center.x, y: center.y + c },
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

  if (name === 'segment' || name === 'seg') {
    const a = readPoint2DArgument(named, positional, ['a', 'from', 'start'], 0, evaluateNumeric)
    const b = readPoint2DArgument(named, positional, ['b', 'to', 'end'], 1, evaluateNumeric)
    if (!a || !b) {
      return null
    }

    const dx = b.x - a.x
    const dy = b.y - a.y
    return {
      a,
      b,
      kind: 'segment',
      length: distanceBetween(a, b),
      midpoint: midpointBetween(a, b),
      slope: Math.abs(dx) < 0.000001 ? null : dy / dx,
    }
  }

  if (name === 'triangle' || name === 'tri') {
    const points = [
      readPoint2DArgument(named, positional, ['a'], 0, evaluateNumeric),
      readPoint2DArgument(named, positional, ['b'], 1, evaluateNumeric),
      readPoint2DArgument(named, positional, ['c'], 2, evaluateNumeric),
    ]
    if (!points[0] || !points[1] || !points[2]) {
      return null
    }

    const trianglePoints = points as [Point2D, Point2D, Point2D]
    const [a, b, c] = trianglePoints
    const sides: [number, number, number] = [
      distanceBetween(a, b),
      distanceBetween(b, c),
      distanceBetween(c, a),
    ]
    const area = Math.abs(
      (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y)) / 2,
    )

    if (area < 0.000001) {
      return null
    }

    return {
      area,
      centroid: {
        x: (a.x + b.x + c.x) / 3,
        y: (a.y + b.y + c.y) / 3,
      },
      kind: 'triangle',
      perimeter: sides.reduce((total, side) => total + side, 0),
      points: trianglePoints,
      sides,
    }
  }

  return null
}

export const parsePrimitive3DObject = (
  expression: string,
  evaluateNumeric: NumericEvaluator,
): Primitive3DObject | null => {
  const call = parseCall(expression)
  if (!call) {
    return null
  }

  const { name, parts } = call
  const { named, positional } = parseNamedArguments(parts)
  const positionalCenter = positional[0] ? parsePoint3D(positional[0], evaluateNumeric) : null
  const center =
    readPoint3DArgument(named, positional, ['center', 'c'], 0, evaluateNumeric) ??
    positionalCenter ??
    { x: 0, y: 0, z: 0 }
  const firstNumericPosition = positionalCenter ? 1 : 0

  if (name === 'line3d' || name === 'line') {
    const a = readPoint3DArgument(named, positional, ['a', 'from', 'start'], 0, evaluateNumeric)
    const b = readPoint3DArgument(named, positional, ['b', 'to', 'end'], 1, evaluateNumeric)
    if (!a || !b) {
      return null
    }

    const length = distanceBetween3D(a, b)
    if (length <= 0.000001) {
      return null
    }

    return {
      a,
      b,
      direction: {
        x: (b.x - a.x) / length,
        y: (b.y - a.y) / length,
        z: (b.z - a.z) / length,
      },
      kind: 'line3d',
      length,
    }
  }

  if (name === 'sphere') {
    const radius = readNumericArgument(named, positional, ['r', 'radius'], firstNumericPosition, evaluateNumeric)
    if (radius === null || radius <= 0) {
      return null
    }

    return {
      center,
      diameter: radius * 2,
      kind: 'sphere',
      radius,
      surfaceArea: 4 * Math.PI * radius * radius,
      volume: (4 / 3) * Math.PI * radius * radius * radius,
    }
  }

  if (name === 'cube') {
    const side = readNumericArgument(named, positional, ['s', 'side'], firstNumericPosition, evaluateNumeric)
    if (side === null || side <= 0) {
      return null
    }

    return {
      center,
      diagonal: side * Math.sqrt(3),
      kind: 'cube',
      side,
      surfaceArea: 6 * side * side,
      volume: side * side * side,
    }
  }

  if (name === 'cylinder') {
    const radius = readNumericArgument(named, positional, ['r', 'radius'], firstNumericPosition, evaluateNumeric)
    const height = readNumericArgument(named, positional, ['h', 'height'], firstNumericPosition + 1, evaluateNumeric)
    if (radius === null || height === null || radius <= 0 || height <= 0) {
      return null
    }

    return {
      center,
      height,
      kind: 'cylinder',
      radius,
      surfaceArea: 2 * Math.PI * radius * (radius + height),
      volume: Math.PI * radius * radius * height,
    }
  }

  if (name === 'cone') {
    const radius = readNumericArgument(named, positional, ['r', 'radius'], firstNumericPosition, evaluateNumeric)
    const height = readNumericArgument(named, positional, ['h', 'height'], firstNumericPosition + 1, evaluateNumeric)
    if (radius === null || height === null || radius <= 0 || height <= 0) {
      return null
    }

    const slantHeight = Math.hypot(radius, height)
    return {
      center,
      height,
      kind: 'cone',
      radius,
      slantHeight,
      surfaceArea: Math.PI * radius * (radius + slantHeight),
      volume: (Math.PI * radius * radius * height) / 3,
    }
  }

  if (name === 'plane') {
    const normal =
      readPoint3DArgument(named, positional, ['normal', 'n'], 0, evaluateNumeric) ??
      { x: 0, y: 1, z: 0 }
    const offset = readNumericArgument(named, positional, ['d', 'offset'], positional[0] ? 1 : 0, evaluateNumeric) ?? 0
    const normalMagnitude = Math.hypot(normal.x, normal.y, normal.z)

    if (normalMagnitude <= 0.000001) {
      return null
    }

    return {
      distanceFromOrigin: Math.abs(offset) / normalMagnitude,
      kind: 'plane',
      normal,
      offset,
    }
  }

  return null
}

export const parseGeometryObject = (
  expression: string,
  evaluateNumeric: NumericEvaluator,
): GeometryObject | null => {
  const geometry2d = parseGeometry2DObject(expression, evaluateNumeric)
  if (geometry2d) {
    return { dimension: '2d', object: geometry2d }
  }

  const geometry3d = parsePrimitive3DObject(expression, evaluateNumeric)
  return geometry3d ? { dimension: '3d', object: geometry3d } : null
}
