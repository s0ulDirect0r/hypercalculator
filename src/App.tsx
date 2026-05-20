import { type ChangeEvent, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Box,
  Circle,
  CircleDot,
  Cone,
  Cuboid,
  Cylinder,
  Delete,
  Dices,
  Eye,
  EyeOff,
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
import {
  AdditiveBlending,
  AmbientLight,
  AxesHelper,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  CircleGeometry,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Float32BufferAttribute,
  GridHelper,
  Group,
  Line,
  LineBasicMaterial,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  OrthographicCamera,
  PerspectiveCamera,
  PlaneGeometry,
  PointLight,
  Points,
  PointsMaterial,
  Quaternion,
  SRGBColorSpace,
  Scene,
  Shape,
  ShapeGeometry,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  Vector2,
  Vector3,
  WebGLRenderer,
  type Material,
} from 'three'
import { type Point2D, type Point3D } from './geometryObjectModel'
import {
  type AnalysisMode,
  type AngleMode,
  type MathAnalysis,
  type VisualizationMode,
  appendToken,
  derivativeAt,
  displayExpression,
  encloseExpressionInFunction,
  evaluateForPoint,
  evaluateMathAnalysis,
  evaluateRawForPoint,
  formatExpressionForDisplay,
  formatExpressionInput,
  formatRootAnalysis,
  formatValue,
  insertPercent,
  isDisplayMathKind,
  makeAnalysis,
  normalizeExpressionForMath,
  parseSimpleDivision,
  plainFromVulgarFraction,
  shouldContinueEvaluatedResult,
  toggleSign,
} from './mathEngine'
import './App.css'

type GeometryComposerKind =
  | 'circle'
  | 'cone'
  | 'cube'
  | 'cylinder'
  | 'hyperbola'
  | 'line3d'
  | 'plane'
  | 'point'
  | 'segment'
  | 'sphere'
  | 'triangle'
type HistoryItem = {
  expression: string
  value: string
}
type CalculatorMode = 'basic' | 'scientific'

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
  hyperbola: {
    dimension: '2d',
    fields: [
      { key: 'cx', label: 'cx' },
      { key: 'cy', label: 'cy' },
      { key: 'a', label: 'a' },
      { key: 'b', label: 'b' },
      { key: 'axis', label: 'axis' },
    ],
    label: 'hyperbola',
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
  hyperbola: { a: '4', axis: 'x', b: '3', cx: '0', cy: '0' },
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
    case 'hyperbola':
      return `hyperbola(center=(${field('cx')},${field('cy')}), a=${field('a', '1')}, b=${field('b', '1')}, axis=${field('axis', 'x')})`
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
    case 'hyperbola':
      return {
        a: randomPositive(2, 6),
        axis: Math.random() > 0.5 ? 'x' : 'y',
        b: randomPositive(1, 5),
        cx: randomInteger(-3, 3),
        cy: randomInteger(-3, 3),
      }
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

const formatPoint = (point: Point2D) => `(${formatValue(point.x)}, ${formatValue(point.y)})`

const formatPoint3D = (point: Point3D) =>
  `(${formatValue(point.x)}, ${formatValue(point.y)}, ${formatValue(point.z)})`

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

const GRAPH_SCALE = 0.55
const MAX_GRAPH_EXTENT = 50
const ORTHOGRAPHIC_HALF_HEIGHT = 5.4

const toGraphPoint = (x: number, y: number, minY = -8, maxY = 8) =>
  new Vector3(x * GRAPH_SCALE, clamp(y, minY, maxY) * GRAPH_SCALE, 0)

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

// WebGLRenderer (this version of three is WebGL2-only) throws straight
// from its constructor when no context can be created — a blocklisted GPU,
// hardware acceleration turned off, a locked-down or virtualized environment.
// Probe once so the viewport can show a notice instead of letting the throw
// unmount the whole calculator.
function isWebGLAvailable(): boolean {
  try {
    return Boolean(document.createElement('canvas').getContext('webgl2'))
  } catch {
    return false
  }
}

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
}) {
  const mountRef = useRef<HTMLDivElement | null>(null)
  const inspectXRef = useRef(inspectX)
  const [webglAvailable] = useState(isWebGLAvailable)

  useEffect(() => {
    inspectXRef.current = inspectX
  }, [inspectX])

  useEffect(() => {
    const mount = mountRef.current
    if (!mount || !webglAvailable) {
      return
    }

    const scene = new Scene()
    const use2D =
      mathAnalysis.kind === 'function2d' ||
      mathAnalysis.kind === 'geometry2d' ||
      mathAnalysis.kind === 'vector' ||
      mathAnalysis.kind === 'complex'
    const width = Math.max(mount.clientWidth, 1)
    const height = Math.max(mount.clientHeight, 1)
    const aspect = width / height
    const camera = use2D
      ? new OrthographicCamera(
          -ORTHOGRAPHIC_HALF_HEIGHT * aspect,
          ORTHOGRAPHIC_HALF_HEIGHT * aspect,
          ORTHOGRAPHIC_HALF_HEIGHT,
          -ORTHOGRAPHIC_HALF_HEIGHT,
          0.1,
          100,
        )
      : new PerspectiveCamera(45, aspect, 0.1, 100)
    if (camera instanceof OrthographicCamera) {
      camera.zoom = graphZoom
    }

    camera.position.set(0, use2D ? 0 : 3.2 / graphZoom, use2D ? 10 : 8 / graphZoom)
    camera.lookAt(0, 0, 0)
    camera.updateProjectionMatrix()

    let renderer: WebGLRenderer
    try {
      renderer = new WebGLRenderer({ antialias: true, alpha: true })
    } catch (error) {
      // Defense in depth: isWebGLAvailable() already gated this effect, so this
      // should not happen — but if context creation still fails, bail out
      // quietly rather than letting the throw unmount the whole React tree.
      console.error('Hypercalculator: WebGL context creation failed.', error)
      return
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(width, height)
    renderer.domElement.style.cursor = mathAnalysis.kind === 'function2d' ? 'crosshair' : 'default'
    mount.appendChild(renderer.domElement)

    const group = new Group()
    scene.add(group)

    scene.add(new AmbientLight(0xffffff, 1.7))
    const keyLight = new PointLight(0xffa238, 18, 30)
    keyLight.position.set(3, 5, 5)
    scene.add(keyLight)
    const rimLight = new PointLight(0x69d2ff, 14, 28)
    rimLight.position.set(-4, -2, 3)
    scene.add(rimLight)
    const spiritIsIdle =
      mathAnalysis.kind === 'scalar' &&
      ['0', ''].includes(normalizeExpressionForMath(expression.trim() || '0'))
    let spiritCloud:
      | {
          base: Float32Array
          idle: boolean
          points: Points
          positions: Float32Array
          shapeTargets: Float32Array[] | null
        }
      | null = null

    const line = (points: Vector3[], color: number, opacity = 1) => {
      const geometry = new BufferGeometry().setFromPoints(points)
      const material = new LineBasicMaterial({
        color,
        transparent: opacity < 1,
        opacity,
      })
      const mesh = new Line(geometry, material)
      group.add(mesh)
      return mesh
    }

    const meshBox = (
      width: number,
      height: number,
      depth: number,
      material: Material,
      position: Vector3,
    ) => {
      const mesh = new Mesh(new BoxGeometry(width, height, depth), material)
      mesh.position.copy(position)
      group.add(mesh)
      return mesh
    }

    const getVisibleMathBounds = () => {
      if (!(camera instanceof OrthographicCamera)) {
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

      const texture = new CanvasTexture(canvas)
      texture.colorSpace = SRGBColorSpace
      const sprite = new Sprite(
        new SpriteMaterial({
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
      const axisMaterial = new MeshBasicMaterial({
        color: 0xd7e6eb,
        transparent: true,
        opacity: 0.88,
      })
      const tickMaterial = new MeshBasicMaterial({
        color: 0xd7e6eb,
        transparent: true,
        opacity: 0.58,
      })
      const originMaterial = new MeshBasicMaterial({
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
            new Vector3(x, bounds.minY * GRAPH_SCALE, -0.02),
            new Vector3(x, bounds.maxY * GRAPH_SCALE, -0.02),
          ],
          color,
          opacity,
        )

        if (Math.abs(tick) > 0.000001) {
          const tickLength = isMajor ? 0.16 : 0.1
          meshBox(0.018 / graphZoom, tickLength / graphZoom, 0.02, tickMaterial, new Vector3(x, axisY * GRAPH_SCALE, 0.02))
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
            new Vector3(bounds.minX * GRAPH_SCALE, y, -0.02),
            new Vector3(bounds.maxX * GRAPH_SCALE, y, -0.02),
          ],
          color,
          opacity,
        )

        if (Math.abs(tick) > 0.000001) {
          const tickLength = isMajor ? 0.16 : 0.1
          meshBox(tickLength / graphZoom, 0.018 / graphZoom, 0.02, tickMaterial, new Vector3(axisX * GRAPH_SCALE, y, 0.02))
        }

        if (axisValuesVisible && Math.abs(tick) > 0.000001) {
          const label = makeTextSprite(formatAxisValue(tick), '#d7e6eb')
          if (label) {
            label.position.set((axisX + labelOffset) * GRAPH_SCALE, y, 0.08)
          }
        }
      }

      meshBox(xRange * GRAPH_SCALE, 0.032 / graphZoom, 0.03, axisMaterial, new Vector3(0, axisY * GRAPH_SCALE, 0.025))
      meshBox(0.032 / graphZoom, yRange * GRAPH_SCALE, 0.03, axisMaterial, new Vector3(axisX * GRAPH_SCALE, 0, 0.025))

      const origin = new Mesh(new CircleGeometry(0.08, 28), originMaterial)
      origin.position.set(0, 0, 0.06)
      group.add(origin)

      if (axisValuesVisible) {
        const originLabel = makeTextSprite('0', '#fff2c9')
        if (originLabel) {
          originLabel.position.set((axisX + labelOffset) * GRAPH_SCALE, (axisY - labelOffset) * GRAPH_SCALE, 0.09)
        }
      }
    }

    const renderSpiritCloud = () => {
      const count = spiritIsIdle ? 1080 : 238
      const positions = new Float32Array(count * 3)
      const base = new Float32Array(count * 3)
      const cloudRadius = spiritIsIdle ? (use2D ? 2.85 : 2.3) : (use2D ? 4.8 : 3.9)
      const randomUnit = (seed: number, salt: number) => {
        const value = Math.sin(seed * 12.9898 + salt * 78.233) * 43758.5453
        return value - Math.floor(value)
      }
      const writeTargetPoint = (target: Float32Array, index: number, x: number, y: number, z: number) => {
        const offset = index * 3
        target[offset] = x
        target[offset + 1] = y
        target[offset + 2] = z
      }
      const makeTarget = (getPoint: (index: number) => Vector3) => {
        const target = new Float32Array(count * 3)
        for (let index = 0; index < count; index += 1) {
          const point = getPoint(index)
          writeTargetPoint(target, index, point.x, point.y, point.z)
        }
        return target
      }
      const edgePoint = (
        edges: Array<[Vector3, Vector3]>,
        index: number,
        jitter = 0.035,
      ) => {
        const seed = index + 1
        const edge = edges[index % edges.length]
        const along = randomUnit(seed, 2)
        return new Vector3().lerpVectors(edge[0], edge[1], along).add(
          new Vector3(
            (randomUnit(seed, 3) - 0.5) * jitter,
            (randomUnit(seed, 4) - 0.5) * jitter,
            (randomUnit(seed, 5) - 0.5) * jitter,
          ),
        )
      }
      const makeIdleShapeTargets = () => {
        const triangleRadius = cloudRadius * 0.96
        const triangleVertices = [0, 1, 2].map((corner) => {
          const angle = -Math.PI / 2 + (corner * Math.PI * 2) / 3
          return new Vector3(Math.cos(angle) * triangleRadius, Math.sin(angle) * triangleRadius, 0)
        })
        const cubeRadius = cloudRadius * 0.68
        const cubeVertices = [-1, 1].flatMap((x) =>
          [-1, 1].flatMap((y) =>
            [-1, 1].map((z) => new Vector3(x * cubeRadius, y * cubeRadius, z * cubeRadius)),
          ),
        )
        const cubeEdges: Array<[Vector3, Vector3]> = [
          [cubeVertices[0], cubeVertices[1]],
          [cubeVertices[0], cubeVertices[2]],
          [cubeVertices[0], cubeVertices[4]],
          [cubeVertices[3], cubeVertices[1]],
          [cubeVertices[3], cubeVertices[2]],
          [cubeVertices[3], cubeVertices[7]],
          [cubeVertices[5], cubeVertices[1]],
          [cubeVertices[5], cubeVertices[4]],
          [cubeVertices[5], cubeVertices[7]],
          [cubeVertices[6], cubeVertices[2]],
          [cubeVertices[6], cubeVertices[4]],
          [cubeVertices[6], cubeVertices[7]],
        ]
        const tetraRadius = cloudRadius * 0.92
        const tetraVertices = [
          new Vector3(1, 1, 1),
          new Vector3(-1, -1, 1),
          new Vector3(-1, 1, -1),
          new Vector3(1, -1, -1),
        ].map((point) => point.normalize().multiplyScalar(tetraRadius))
        const tetraEdges: Array<[Vector3, Vector3]> = [
          [tetraVertices[0], tetraVertices[1]],
          [tetraVertices[0], tetraVertices[2]],
          [tetraVertices[0], tetraVertices[3]],
          [tetraVertices[1], tetraVertices[2]],
          [tetraVertices[1], tetraVertices[3]],
          [tetraVertices[2], tetraVertices[3]],
        ]

        return [
          makeTarget((index) => {
            const seed = index + 1
            const theta = seed * 2.399963
            const phi = Math.acos(1 - (2 * (seed - 0.5)) / count)
            const radialSeed = randomUnit(seed, 1)
            const radius = cloudRadius * (0.18 + Math.pow(radialSeed, 1.85) * 0.82)
            return new Vector3(
              Math.cos(theta) * Math.sin(phi) * radius,
              Math.sin(theta) * Math.sin(phi) * radius * (use2D ? 0.72 : 1),
              use2D ? -0.16 + Math.sin(seed * 0.61) * 0.08 : Math.cos(phi) * radius,
            )
          }),
          makeTarget((index) => {
            const seed = index + 1
            const theta = seed * 2.399963
            const tube = randomUnit(seed, 6) * Math.PI * 2
            const major = cloudRadius * 0.78
            const minor = cloudRadius * 0.16
            const ringRadius = major + Math.cos(tube) * minor
            return new Vector3(
              Math.cos(theta) * ringRadius,
              Math.sin(theta) * ringRadius * 0.74,
              Math.sin(tube) * minor,
            )
          }),
          makeTarget((index) => {
            const seed = index + 1
            const side = index % 3
            const nextSide = (side + 1) % 3
            const along = randomUnit(seed, 7)
            return new Vector3()
              .lerpVectors(triangleVertices[side], triangleVertices[nextSide], along)
              .add(
                new Vector3(
                  (randomUnit(seed, 8) - 0.5) * cloudRadius * 0.08,
                  (randomUnit(seed, 9) - 0.5) * cloudRadius * 0.08,
                  (randomUnit(seed, 10) - 0.5) * cloudRadius * 0.08,
                ),
              )
          }),
          makeTarget((index) => edgePoint(cubeEdges, index, cloudRadius * 0.06)),
          makeTarget((index) => {
            const seed = index + 1
            const theta = (index / count) * Math.PI * 2
            const denominator = 1 + Math.sin(theta) * Math.sin(theta)
            const x = (cloudRadius * 1.04 * Math.cos(theta)) / denominator
            const y = (cloudRadius * 0.78 * Math.sin(theta) * Math.cos(theta)) / denominator
            return new Vector3(
              x,
              y,
              Math.sin(theta * 2 + randomUnit(seed, 11)) * cloudRadius * 0.12,
            )
          }),
          makeTarget((index) => {
            const seed = index + 1
            const progress = index / Math.max(count - 1, 1)
            const strand = index % 2 === 0 ? 0 : Math.PI
            const angle = progress * Math.PI * 7.5 + strand
            const radius = cloudRadius * (0.18 + progress * 0.72)
            return new Vector3(
              Math.cos(angle) * radius,
              (progress - 0.5) * cloudRadius * 1.55,
              Math.sin(angle) * radius * 0.7 + (randomUnit(seed, 12) - 0.5) * cloudRadius * 0.06,
            )
          }),
          makeTarget((index) => edgePoint(tetraEdges, index, cloudRadius * 0.055)),
        ]
      }
      const shapeTargets = spiritIsIdle ? makeIdleShapeTargets() : null

      for (let index = 0; index < count; index += 1) {
        const seed = index + 1
        const theta = seed * 2.399963
        const phi = Math.acos(1 - (2 * (seed - 0.5)) / count)
        const radialSeed = ((seed * 37) % 100) / 99
        const radialNoise = spiritIsIdle
          ? 0.18 + Math.pow(radialSeed, 1.85) * 0.82
          : 0.92 + radialSeed * 0.24
        const radius = spiritIsIdle
          ? cloudRadius * radialNoise
          : cloudRadius + Math.sin(seed * 1.77) * 0.34
        const x = Math.cos(theta) * Math.sin(phi) * radius
        const y = Math.sin(theta) * Math.sin(phi) * radius * (use2D ? 0.72 : 1)
        const z = use2D ? -0.16 + Math.sin(seed * 0.61) * 0.08 : Math.cos(phi) * radius

        const offset = index * 3
        const target = shapeTargets?.[0]
        const initialX = target ? target[offset] : x
        const initialY = target ? target[offset + 1] : y
        const initialZ = target ? target[offset + 2] : z
        positions[offset] = initialX
        positions[offset + 1] = initialY
        positions[offset + 2] = initialZ
        base[offset] = initialX
        base[offset + 1] = initialY
        base[offset + 2] = initialZ
      }

      const geometry = new BufferGeometry()
      geometry.setAttribute('position', new BufferAttribute(positions, 3))
      const material = new PointsMaterial({
        color: spiritIsIdle ? 0x8ff3ff : 0x6ee7ff,
        depthWrite: false,
        opacity: spiritIsIdle ? 0.82 : 0.26,
        size: use2D ? (spiritIsIdle ? 0.056 : 0.045) / graphZoom : spiritIsIdle ? 0.064 : 0.055,
        transparent: true,
        blending: AdditiveBlending,
      })
      const points = new Points(geometry, material)
      points.position.z = use2D ? -0.04 : 0
      group.add(points)
      spiritCloud = { base, idle: spiritIsIdle, points, positions, shapeTargets }
    }

    const render3DReferenceFrame = () => {
      const grid = new GridHelper(12, 24, 0x315866, 0x14242b)
      grid.position.y = -2.2
      group.add(grid)

      const axes = new AxesHelper(3.4)
      axes.position.y = -2.2
      group.add(axes)

      if (axisValuesVisible) {
        const axisLabels: Array<[string, string, Vector3]> = [
          ['x=3', '#ffb1a8', new Vector3(3.55, -2.2, 0)],
          ['x=-3', '#ffb1a8', new Vector3(-3.55, -2.2, 0)],
          ['y=3', '#b4ffc9', new Vector3(0, 1.15, 0)],
          ['z=3', '#8fc8ff', new Vector3(0, -2.2, 3.55)],
          ['z=-3', '#8fc8ff', new Vector3(0, -2.2, -3.55)],
          ['0', '#fff2c9', new Vector3(0, -2.2, 0)],
        ]

        axisLabels.forEach(([label, color, position]) => {
          const sprite = makeTextSprite(label, color)
          if (sprite) {
            sprite.position.copy(position)
          }
        })
      }
    }

    renderSpiritCloud()
    let updateInspectIndicator: (() => void) | null = null

    if (mathAnalysis.kind === 'function2d') {
      render2DGrid()

      const bounds = getVisibleMathBounds()
      const sourceExpression = expression.trim() || '0'
      const activeExpression = mathAnalysis.activeExpression.trim() || sourceExpression
      const hasTransform = activeExpression !== sourceExpression
      const buildCurveSegments = (curveExpression: string) => {
        const segments: Vector3[][] = []
        let currentSegment: Vector3[] = []
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
            new MeshBasicMaterial({
              color: 0x6ee7ff,
              transparent: true,
              opacity: 0.78,
            }),
            new Vector3(((bounds.minX + bounds.maxX) / 2) * GRAPH_SCALE, activePoints[0].y, 0.045),
          )
        }
        activeSegments.forEach((segment) => line(segment, 0x6ee7ff, 1))
      }

      const inspectLineGeometry = new BufferGeometry().setFromPoints([
        new Vector3(0, 0, 0.01),
        new Vector3(0, 0, 0.01),
      ])
      const inspectLine = new Line(
        inspectLineGeometry,
        new LineBasicMaterial({
          color: 0xfff2c9,
          opacity: 0.28,
          transparent: true,
        }),
      )
      group.add(inspectLine)

      const inspectMarker = new Mesh(
        new CircleGeometry(0.13, 32),
        new MeshBasicMaterial({ color: 0xfff2c9 }),
      )
      inspectMarker.position.z = 0.07
      group.add(inspectMarker)

      updateInspectIndicator = () => {
        const nextInspectX = inspectXRef.current
        const nextBounds = getVisibleMathBounds()
        const inspectedY = evaluateRawForPoint(activeExpression, angleMode, nextInspectX)
        const xVisible = nextInspectX >= nextBounds.minX && nextInspectX <= nextBounds.maxX
        const yVisible =
          inspectedY !== null &&
          inspectedY >= nextBounds.minY &&
          inspectedY <= nextBounds.maxY

        inspectLine.visible = xVisible
        inspectMarker.visible = xVisible && yVisible

        if (xVisible) {
          const linePositions = inspectLineGeometry.getAttribute('position')
          const bottom = toGraphPoint(nextInspectX, nextBounds.minY, nextBounds.minY, nextBounds.maxY).setZ(0.01)
          const top = toGraphPoint(nextInspectX, nextBounds.maxY, nextBounds.minY, nextBounds.maxY).setZ(0.01)
          linePositions.setXYZ(0, bottom.x, bottom.y, bottom.z)
          linePositions.setXYZ(1, top.x, top.y, top.z)
          linePositions.needsUpdate = true
        }

        if (inspectedY !== null && yVisible) {
          inspectMarker.position.copy(
            toGraphPoint(nextInspectX, inspectedY, nextBounds.minY, nextBounds.maxY),
          )
          inspectMarker.position.z = 0.07
        }
      }
      updateInspectIndicator()

      if (analysisMode === 'integral') {
        const areaPoints: Vector3[] = [toGraphPoint(-2, 0, bounds.minY, bounds.maxY)]
        for (let index = 0; index <= 120; index += 1) {
          const x = -2 + (4 * index) / 120
          const y = evaluateForPoint(sourceExpression, angleMode, x)
          areaPoints.push(toGraphPoint(x, y ?? 0, bounds.minY, bounds.maxY))
        }
        areaPoints.push(toGraphPoint(2, 0, bounds.minY, bounds.maxY))

        const shape = new Shape(areaPoints.map((point) => new Vector2(point.x, point.y)))
        const area = new Mesh(
          new ShapeGeometry(shape),
          new MeshBasicMaterial({
            color: 0xffa238,
            transparent: true,
            opacity: 0.24,
            side: DoubleSide,
          }),
        )
        area.position.z = -0.02
        group.add(area)
      }

      if (mathAnalysis.activeRootAnalysis.kind === 'roots') {
        mathAnalysis.activeRootAnalysis.roots
          .filter((root) => root >= bounds.minX && root <= bounds.maxX)
          .forEach((root) => {
            const marker = new Mesh(
              new CircleGeometry(0.13, 32),
              new MeshBasicMaterial({ color: 0xfff2c9 }),
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
      const geometryMaterial = new MeshBasicMaterial({
        color: 0x6ee7ff,
        transparent: true,
        opacity: 0.95,
      })
      const accentMaterial = new MeshBasicMaterial({
        color: 0xfff2c9,
        transparent: true,
        opacity: 0.95,
      })
      const fillMaterial = new MeshBasicMaterial({
        color: 0x6ee7ff,
        side: DoubleSide,
        transparent: true,
        opacity: 0.16,
      })
      const geometryPoint = (point: Point2D, z = 0.05) =>
        new Vector3(point.x * GRAPH_SCALE, point.y * GRAPH_SCALE, z)
      const drawPoint = (point: Point2D, label: string, material = accentMaterial) => {
        if (point.x < bounds.minX || point.x > bounds.maxX || point.y < bounds.minY || point.y > bounds.maxY) {
          return
        }

        const marker = new Mesh(new CircleGeometry(0.13 / graphZoom, 28), material)
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
        const points: Vector3[] = []
        for (let index = 0; index <= 240; index += 1) {
          const theta = (Math.PI * 2 * index) / 240
          const x = geometry.center.x + Math.cos(theta) * geometry.radius
          const y = geometry.center.y + Math.sin(theta) * geometry.radius
          points.push(new Vector3(x * GRAPH_SCALE, y * GRAPH_SCALE, 0.05))
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
      } else if (geometry?.kind === 'hyperbola') {
        const lineIntersections = (slope: number) => {
          const candidates: Point2D[] = [
            {
              x: bounds.minX,
              y: geometry.center.y + slope * (bounds.minX - geometry.center.x),
            },
            {
              x: bounds.maxX,
              y: geometry.center.y + slope * (bounds.maxX - geometry.center.x),
            },
          ]

          if (Math.abs(slope) > 0.000001) {
            candidates.push(
              {
                x: geometry.center.x + (bounds.minY - geometry.center.y) / slope,
                y: bounds.minY,
              },
              {
                x: geometry.center.x + (bounds.maxY - geometry.center.y) / slope,
                y: bounds.maxY,
              },
            )
          }

          return candidates
            .filter(
              (point) =>
                point.x >= bounds.minX - 0.000001 &&
                point.x <= bounds.maxX + 0.000001 &&
                point.y >= bounds.minY - 0.000001 &&
                point.y <= bounds.maxY + 0.000001,
            )
            .filter(
              (point, index, points) =>
                points.findIndex(
                  (candidate) =>
                    Math.abs(candidate.x - point.x) < 0.000001 &&
                    Math.abs(candidate.y - point.y) < 0.000001,
                ) === index,
            )
            .slice(0, 2)
        }
        const drawAsymptote = (slope: number) => {
          const points = lineIntersections(slope)
          if (points.length === 2) {
            line(points.map((point) => geometryPoint(point, 0.025)), 0xffa238, 0.42)
          }
        }
        const drawBranch = (points: Point2D[]) => {
          const visiblePoints = points.filter(
            (point) =>
              point.x >= bounds.minX &&
              point.x <= bounds.maxX &&
              point.y >= bounds.minY &&
              point.y <= bounds.maxY,
          )
          if (visiblePoints.length > 1) {
            line(visiblePoints.map((point) => geometryPoint(point, 0.07)), 0x6ee7ff, 1)
          }
        }
        const sampleCount = 220
        const makeHorizontalBranch = (direction: -1 | 1, sign: -1 | 1) => {
          const start = direction < 0 ? bounds.minX : geometry.center.x + geometry.a
          const end = direction < 0 ? geometry.center.x - geometry.a : bounds.maxX
          if (start > end) {
            return []
          }

          return Array.from({ length: sampleCount + 1 }, (_, index) => {
            const x = start + ((end - start) * index) / sampleCount
            const offset = Math.abs(x - geometry.center.x)
            const yOffset = (geometry.b / geometry.a) * Math.sqrt(Math.max(offset * offset - geometry.a * geometry.a, 0))
            return { x, y: geometry.center.y + sign * yOffset }
          })
        }
        const makeVerticalBranch = (direction: -1 | 1, sign: -1 | 1) => {
          const start = direction < 0 ? bounds.minY : geometry.center.y + geometry.a
          const end = direction < 0 ? geometry.center.y - geometry.a : bounds.maxY
          if (start > end) {
            return []
          }

          return Array.from({ length: sampleCount + 1 }, (_, index) => {
            const y = start + ((end - start) * index) / sampleCount
            const offset = Math.abs(y - geometry.center.y)
            const xOffset = (geometry.b / geometry.a) * Math.sqrt(Math.max(offset * offset - geometry.a * geometry.a, 0))
            return { x: geometry.center.x + sign * xOffset, y }
          })
        }

        drawAsymptote(geometry.asymptoteSlopes[0])
        drawAsymptote(geometry.asymptoteSlopes[1])
        line(
          [
            geometryPoint(geometry.vertices[0], 0.04),
            geometryPoint(geometry.vertices[1], 0.04),
          ],
          0xfff2c9,
          0.72,
        )

        const branchDirections = [-1, 1] as const
        if (geometry.transverseAxis === 'x') {
          branchDirections.forEach((direction) => {
            branchDirections.forEach((sign) => drawBranch(makeHorizontalBranch(direction, sign)))
          })
        } else {
          branchDirections.forEach((direction) => {
            branchDirections.forEach((sign) => drawBranch(makeVerticalBranch(direction, sign)))
          })
        }

        drawPoint(geometry.center, 'C')
        geometry.vertices.forEach((point) => drawPoint(point, 'V', geometryMaterial))
        geometry.foci.forEach((point) => drawPoint(point, 'F'))
      } else if (geometry?.kind === 'triangle') {
        const trianglePoints = geometry.points.map((point) =>
          geometryPoint(point),
        )
        const shape = new Shape(trianglePoints.map((point) => new Vector2(point.x, point.y)))
        const fill = new Mesh(new ShapeGeometry(shape), fillMaterial)
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
        const componentMaterial = new LineBasicMaterial({
          color: 0xffa238,
          transparent: true,
          opacity: 0.75,
        })
        group.add(
          new Line(
            new BufferGeometry().setFromPoints([
              new Vector3(end.x, 0, 0.01),
              new Vector3(end.x, end.y, 0.01),
              new Vector3(0, end.y, 0.01),
            ]),
            componentMaterial,
          ),
        )
        line([new Vector3(0, 0, 0.03), end.clone().setZ(0.03)], 0x6ee7ff, 1)

        const marker = new Mesh(
          new CircleGeometry(0.16, 32),
          new MeshBasicMaterial({ color: 0x6ee7ff }),
        )
        marker.position.copy(end)
        marker.position.z = 0.08
        group.add(marker)

        if (mathAnalysis.kind === 'complex') {
          const conjugate = toGraphPoint(vector.x, -vector.y)
          line([new Vector3(0, 0, 0.02), conjugate.clone().setZ(0.02)], 0xffa238, 0.75)
          const conjugateMarker = new Mesh(
            new CircleGeometry(0.11, 32),
            new MeshBasicMaterial({ color: 0xffa238 }),
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
          new Vector3(point.x * primitiveScale, point.y * primitiveScale, point.z * primitiveScale)
        const solidMaterial = new MeshStandardMaterial({
          color: 0x60e6ff,
          emissive: 0x0a4050,
          metalness: 0.18,
          roughness: 0.28,
          side: DoubleSide,
          transparent: true,
          opacity: 0.74,
        })
        const wireMaterial = new MeshBasicMaterial({
          color: 0xffa238,
          opacity: 0.24,
          transparent: true,
          wireframe: true,
        })
        const accentMaterial = new MeshStandardMaterial({
          color: 0xfff2c9,
          emissive: 0x493a14,
          metalness: 0.12,
          roughness: 0.24,
        })
        const addPrimitiveMesh = (
          geometry: BufferGeometry,
          position: Vector3,
          quaternion?: Quaternion,
          material = solidMaterial,
        ) => {
          const mesh = new Mesh(geometry, material)
          mesh.position.copy(position)
          if (quaternion) {
            mesh.quaternion.copy(quaternion)
          }
          group.add(mesh)

          const wire = new Mesh(geometry.clone(), wireMaterial)
          wire.position.copy(position)
          wire.quaternion.copy(mesh.quaternion)
          group.add(wire)
          return mesh
        }
        const addCenterMarker = (center: Point3D) => {
          const marker = new Mesh(new SphereGeometry(0.08, 24, 16), accentMaterial)
          marker.position.copy(toScenePoint3D(center))
          group.add(marker)
        }

        if (primitive.kind === 'sphere') {
          const center = toScenePoint3D(primitive.center)
          const radius = primitive.radius * primitiveScale
          addPrimitiveMesh(new SphereGeometry(radius, 48, 32), center)
          addCenterMarker(primitive.center)
          line([center, center.clone().add(new Vector3(radius, 0, 0))], 0xfff2c9, 0.82)
        } else if (primitive.kind === 'cube') {
          const side = primitive.side * primitiveScale
          addPrimitiveMesh(new BoxGeometry(side, side, side), toScenePoint3D(primitive.center))
          addCenterMarker(primitive.center)
        } else if (primitive.kind === 'cylinder') {
          const center = toScenePoint3D(primitive.center)
          const radius = primitive.radius * primitiveScale
          const height = primitive.height * primitiveScale
          addPrimitiveMesh(new CylinderGeometry(radius, radius, height, 64, 1, false), center)
          addCenterMarker(primitive.center)
          line(
            [
              center.clone().add(new Vector3(0, -height / 2, 0)),
              center.clone().add(new Vector3(0, height / 2, 0)),
            ],
            0xfff2c9,
            0.78,
          )
          line([center, center.clone().add(new Vector3(radius, 0, 0))], 0xfff2c9, 0.72)
        } else if (primitive.kind === 'cone') {
          const center = toScenePoint3D(primitive.center)
          const radius = primitive.radius * primitiveScale
          const height = primitive.height * primitiveScale
          addPrimitiveMesh(new ConeGeometry(radius, height, 64, 1, false), center)
          addCenterMarker(primitive.center)
          line(
            [
              center.clone().add(new Vector3(0, -height / 2, 0)),
              center.clone().add(new Vector3(0, height / 2, 0)),
            ],
            0xfff2c9,
            0.78,
          )
          line(
            [
              center.clone().add(new Vector3(0, height / 2, 0)),
              center.clone().add(new Vector3(radius, -height / 2, 0)),
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
          const markerA = new Mesh(new SphereGeometry(0.08, 24, 16), accentMaterial)
          markerA.position.copy(a)
          group.add(markerA)
          const markerB = new Mesh(new SphereGeometry(0.08, 24, 16), accentMaterial)
          markerB.position.copy(b)
          group.add(markerB)
        } else {
          const normal = new Vector3(primitive.normal.x, primitive.normal.y, primitive.normal.z)
          const normalLength = normal.length()
          const unitNormal = normal.clone().normalize()
          const position = unitNormal.clone().multiplyScalar((primitive.offset / normalLength) * primitiveScale)
          const quaternion = new Quaternion().setFromUnitVectors(
            new Vector3(0, 0, 1),
            unitNormal,
          )
          const planeMaterial = new MeshStandardMaterial({
            color: 0x60e6ff,
            emissive: 0x0a4050,
            metalness: 0.12,
            roughness: 0.34,
            side: DoubleSide,
            transparent: true,
            opacity: 0.34,
          })

          addPrimitiveMesh(new PlaneGeometry(7, 7, 12, 12), position, quaternion, planeMaterial)
          line([position, position.clone().add(unitNormal.multiplyScalar(1.5))], 0xfff2c9, 0.88)
        }
      }
    } else if (mathAnalysis.kind === 'surface3d') {
      const grid = new GridHelper(12, 24, 0x315866, 0x14242b)
      grid.position.y = -2.2
      group.add(grid)
      const axes = new AxesHelper(3.4)
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

      const geometry = new BufferGeometry()
      geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
      geometry.setIndex(indices)
      geometry.computeVertexNormals()

      group.add(
        new Mesh(
          geometry,
          new MeshStandardMaterial({
            color: 0x60e6ff,
            emissive: 0x0a4050,
            metalness: 0.2,
            roughness: 0.26,
            side: DoubleSide,
            transparent: true,
            opacity: 0.72,
          }),
        ),
      )
      group.add(
        new Mesh(
          geometry,
          new MeshBasicMaterial({
            color: 0xffa238,
            opacity: 0.2,
            transparent: true,
            wireframe: true,
          }),
        ),
      )
    } else if (mathAnalysis.kind === 'ratio') {
      const divisionParts = parseSimpleDivision(expression)
      const grid = new GridHelper(12, 24, 0x315866, 0x14242b)
      grid.position.y = -2.2
      group.add(grid)

      if (divisionParts) {
        const barWidth = 5.4
        const segmentCount = clamp(Math.round(divisionParts.denominator), 2, 48)
        const filledSegments =
          divisionParts.remainder === null
            ? Math.round(divisionParts.fraction * segmentCount)
            : Math.round((divisionParts.remainder / divisionParts.denominator) * segmentCount)
        const fullMaterial = new MeshStandardMaterial({
          color: 0xffa238,
          emissive: 0x5f2600,
          metalness: 0.35,
          roughness: 0.28,
        })
        const fractionMaterial = new MeshStandardMaterial({
          color: 0x6ee7ff,
          emissive: 0x104a59,
          metalness: 0.2,
          roughness: 0.24,
        })
        const tickMaterial = new MeshBasicMaterial({
          color: 0xf4f8ff,
          opacity: 0.55,
          transparent: true,
        })

        for (let index = 0; index < Math.min(divisionParts.whole, 4); index += 1) {
          meshBox(barWidth, 0.34, 0.5, fullMaterial, new Vector3(0, 0.42 + index * 0.48, 0))
        }

        const fractionWidth = Math.max(barWidth * divisionParts.fraction, 0.04)
        meshBox(
          fractionWidth,
          0.34,
          0.5,
          fractionMaterial,
          new Vector3(-barWidth / 2 + fractionWidth / 2, -0.24, 0),
        )

        for (let index = 0; index <= segmentCount; index += 1) {
          const x = -barWidth / 2 + (index / segmentCount) * barWidth
          meshBox(0.018, index % 5 === 0 ? 0.5 : 0.32, 0.58, tickMaterial, new Vector3(x, -0.24, 0.05))
        }

        for (let index = 0; index < filledSegments; index += 1) {
          const segmentWidth = barWidth / segmentCount
          meshBox(
            segmentWidth * 0.72,
            0.08,
            0.68,
            fractionMaterial,
            new Vector3(-barWidth / 2 + segmentWidth * (index + 0.5), -0.74, 0.02),
          )
        }
      }
    } else if (!spiritIsIdle) {
      const scalar = Number.isFinite(numericValue ?? NaN) ? Number(numericValue) : 0
      const visibleValue = clamp(scalar, -10, 10)
      const scaleWidth = 6
      const scaleMaterial = new MeshBasicMaterial({
        color: 0xf4f8ff,
        opacity: 0.18,
        transparent: true,
      })
      const tickMaterial = new MeshBasicMaterial({
        color: 0xf4f8ff,
        opacity: 0.52,
        transparent: true,
      })
      const valueMaterial = new MeshStandardMaterial({
        color: scalar < 0 ? 0xffa238 : 0x6ee7ff,
        emissive: scalar < 0 ? 0x5f2600 : 0x104a59,
        metalness: 0.22,
        roughness: 0.28,
      })
      const zeroMaterial = new MeshStandardMaterial({
        color: 0xf4f8ff,
        emissive: 0x111820,
        metalness: 0.14,
        roughness: 0.32,
      })

      meshBox(scaleWidth, 0.04, 0.08, scaleMaterial, new Vector3(0, -0.4, 0))
      for (let tick = -10; tick <= 10; tick += 1) {
        meshBox(
          0.022,
          tick === 0 ? 0.76 : tick % 5 === 0 ? 0.46 : 0.28,
          0.1,
          tickMaterial,
          new Vector3((tick / 10) * (scaleWidth / 2), -0.4, 0.02),
        )
      }

      const valueX = (visibleValue / 10) * (scaleWidth / 2)
      const distance = Math.abs(valueX)
      if (distance > 0.025) {
        meshBox(distance, 0.22, 0.48, valueMaterial, new Vector3(valueX / 2, -0.05, 0))
      }

      const origin = new Mesh(new CylinderGeometry(0.16, 0.16, 0.08, 36), zeroMaterial)
      origin.rotation.x = Math.PI / 2
      origin.position.set(0, -0.4, 0.12)
      group.add(origin)

      const marker = new Mesh(new CylinderGeometry(0.22, 0.22, 0.14, 36), valueMaterial)
      marker.rotation.x = Math.PI / 2
      marker.position.set(valueX, 0.18, 0.12)
      marker.scale.x = scalar === 0 ? 0.78 : 1
      marker.scale.y = scalar === 0 ? 0.78 : 1
      group.add(marker)
    }

    const resizeObserver = new ResizeObserver(([entry]) => {
      const { width: nextWidth, height: nextHeight } = entry.contentRect
      renderer.setSize(nextWidth, nextHeight)

      if (camera instanceof PerspectiveCamera) {
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
      if (mathAnalysis.kind !== 'function2d' || !(camera instanceof OrthographicCamera)) {
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
    const startedAt = Date.now() * 0.001
    const idleRandomUnit = (seed: number, salt: number) => {
      const value = Math.sin(seed * 91.177 + salt * 37.719) * 13971.423
      return value - Math.floor(value)
    }
    const makeIdleShapeSchedule = () => {
      const schedule: Array<{ duration: number; morph: number; shape: number }> = []
      const playfulShapeCount = 6
      let lastShape = 0

      for (let phrase = 0; phrase < 18; phrase += 1) {
        const shouldRestFirst = phrase === 0 || idleRandomUnit(phrase, 1) > 0.28
        if (shouldRestFirst) {
          schedule.push({
            duration: 5.5 + idleRandomUnit(phrase, 2) * 8.4,
            morph: 0.8 + idleRandomUnit(phrase, 3) * 0.85,
            shape: 0,
          })
          lastShape = 0
        }

        const flowRoll = idleRandomUnit(phrase, 4)
        const flowLength = flowRoll > 0.76 ? 4 : flowRoll > 0.42 ? 3 : 1 + Math.floor(idleRandomUnit(phrase, 5) * 2)

        for (let step = 0; step < flowLength; step += 1) {
          const seed = phrase * 10 + step
          let nextShape = 1 + Math.floor(idleRandomUnit(seed, 6) * playfulShapeCount)
          if (nextShape === lastShape) {
            nextShape = (nextShape % playfulShapeCount) + 1
          }

          schedule.push({
            duration: 2.4 + idleRandomUnit(seed, 7) * 3.2,
            morph: 0.75 + idleRandomUnit(seed, 8) * 0.75,
            shape: nextShape,
          })
          lastShape = nextShape
        }

        if (idleRandomUnit(phrase, 9) > 0.18) {
          schedule.push({
            duration: 4.2 + idleRandomUnit(phrase, 10) * 9.6,
            morph: 1 + idleRandomUnit(phrase, 11) * 0.95,
            shape: 0,
          })
          lastShape = 0
        }
      }

      return schedule
    }
    const idleShapeSchedule = makeIdleShapeSchedule()
    const idleShapeCycleDuration = idleShapeSchedule.reduce((total, item) => total + item.duration, 0)
    const getIdleShapeBlend = (elapsedSeconds: number, shapeCount: number) => {
      if (shapeCount <= 0) {
        return {
          fromShapeIndex: 0,
          morphProgress: 0,
          toShapeIndex: 0,
        }
      }

      let localTime = elapsedSeconds % idleShapeCycleDuration
      let scheduleIndex = 0
      for (; scheduleIndex < idleShapeSchedule.length; scheduleIndex += 1) {
        const item = idleShapeSchedule[scheduleIndex]
        if (localTime <= item.duration) {
          break
        }
        localTime -= item.duration
      }

      const item = idleShapeSchedule[scheduleIndex] ?? idleShapeSchedule[0]
      const previousItem =
        idleShapeSchedule[(scheduleIndex - 1 + idleShapeSchedule.length) % idleShapeSchedule.length]
      const transitionDuration = Math.min(item.morph, item.duration * 0.45)
      const activeMorphProgress = clamp(localTime / Math.max(transitionDuration, 0.001), 0, 1)
      const morphProgress =
        activeMorphProgress * activeMorphProgress * (3 - 2 * activeMorphProgress)

      return {
        fromShapeIndex: previousItem.shape % shapeCount,
        morphProgress,
        toShapeIndex: item.shape % shapeCount,
      }
    }
    const animate = () => {
      animationFrame = requestAnimationFrame(animate)
      const elapsed = Date.now() * 0.001 - startedAt
      if (spiritCloud) {
        const amplitude = spiritCloud.idle ? 0.13 : 0.045
        const shapeTargets = spiritCloud.shapeTargets
        const shapeCount = shapeTargets?.length ?? 0
        const { fromShapeIndex, morphProgress, toShapeIndex } = getIdleShapeBlend(elapsed, shapeCount)

        for (let index = 0; index < spiritCloud.positions.length / 3; index += 1) {
          const offset = index * 3
          const pulse = Math.sin(elapsed * (spiritCloud.idle ? 0.85 : 0.55) + index * 0.37)
          const drift = Math.cos(elapsed * 0.42 + index * 0.19)
          const fromShape = shapeTargets?.[fromShapeIndex]
          const toShape = shapeTargets?.[toShapeIndex]
          const baseX =
            fromShape && toShape
              ? fromShape[offset] * (1 - morphProgress) + toShape[offset] * morphProgress
              : spiritCloud.base[offset]
          const baseY =
            fromShape && toShape
              ? fromShape[offset + 1] * (1 - morphProgress) + toShape[offset + 1] * morphProgress
              : spiritCloud.base[offset + 1]
          const baseZ =
            fromShape && toShape
              ? fromShape[offset + 2] * (1 - morphProgress) + toShape[offset + 2] * morphProgress
              : spiritCloud.base[offset + 2]

          spiritCloud.positions[offset] = baseX + drift * amplitude * 0.38
          spiritCloud.positions[offset + 1] = baseY + pulse * amplitude
          spiritCloud.positions[offset + 2] = baseZ + drift * amplitude * 0.24
        }
        const positionAttribute = spiritCloud.points.geometry.getAttribute('position')
        positionAttribute.needsUpdate = true
        spiritCloud.points.rotation.z += spiritCloud.idle ? 0.00115 : 0.00025
        if (!use2D) {
          spiritCloud.points.rotation.y += spiritCloud.idle ? 0.00135 : 0.00035
        }
      }
      if (orbitEnabled && !use2D) {
        group.rotation.y += 0.003
        group.rotation.x = Math.sin(Date.now() * 0.00035) * 0.08
      }
      updateInspectIndicator?.()
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
        if (object instanceof Mesh || object instanceof Line || object instanceof Points) {
          object.geometry.dispose()
          if (Array.isArray(object.material)) {
            object.material.forEach((material) => material.dispose())
          } else {
            object.material.dispose()
          }
        } else if (object instanceof Sprite) {
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
    mathAnalysis,
    numericValue,
    onInspectXChange,
    orbitEnabled,
    webglAvailable,
  ])

  if (!webglAvailable) {
    return (
      <div
        className="math-viewport math-viewport--unavailable"
        aria-label="Mathematical object visualization"
      >
        <p>Visualization unavailable</p>
        <p>
          WebGL is disabled in this browser, so graphs and 3D objects can’t render. The
          calculator and all its math still work.
        </p>
      </div>
    )
  }

  return <div className="math-viewport" ref={mountRef} aria-label="Mathematical object visualization" />
}

function App() {
  const initialExpression = formatExpressionInput('0')
  const [expression, setExpression] = useState(initialExpression)
  const [committedExpression, setCommittedExpression] = useState(initialExpression)
  const [angleMode, setAngleMode] = useState<AngleMode>('deg')
  const [calculatorMode, setCalculatorMode] = useState<CalculatorMode>('basic')
  const [visualizationMode, setVisualizationMode] = useState<VisualizationMode>('auto')
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode>('function')
  const [axisValuesVisible, setAxisValuesVisible] = useState(true)
  const [canvasVisible, setCanvasVisible] = useState(true)
  const [graphZoom, setGraphZoom] = useState(1)
  const [inspectX, setInspectX] = useState(1)
  const [orbitEnabled, setOrbitEnabled] = useState(false)
  const [memory, setMemory] = useState(0)
  const [secondary, setSecondary] = useState(false)
  const [shiftSecondary, setShiftSecondary] = useState(false)
  const [lastActionWasEvaluation, setLastActionWasEvaluation] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [geometryComposerOpen, setGeometryComposerOpen] = useState(false)
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

      if (geometry.kind === 'hyperbola') {
        const asymptoteBase =
          Math.abs(geometry.center.x) < 0.000001 && Math.abs(geometry.center.y) < 0.000001
            ? `y = ±${formatValue(Math.abs(geometry.asymptoteSlopes[1]))}x`
            : `y - ${formatValue(geometry.center.y)} = ±${formatValue(Math.abs(geometry.asymptoteSlopes[1]))}(x - ${formatValue(geometry.center.x)})`

        return [
          ['type', 'hyperbola'],
          ['center', formatPoint(geometry.center)],
          ['opens', geometry.transverseAxis === 'x' ? 'left and right' : 'up and down'],
          ['a, b, c', `${formatValue(geometry.a)}, ${formatValue(geometry.b)}, ${formatValue(geometry.c)}`],
          ['vertices', geometry.vertices.map(formatPoint).join(', ')],
          ['foci', geometry.foci.map(formatPoint).join(', ')],
          ['asymptotes', asymptoteBase],
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

  const updateInspectX = useCallback((value: number) => {
    if (!Number.isFinite(value)) {
      return
    }

    setInspectX(Number(clamp(value, -MAX_GRAPH_EXTENT, MAX_GRAPH_EXTENT).toFixed(2)))
  }, [])

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
      case 'sqrt(':
        setExpression((current) => {
          const baseExpression =
            lastActionWasEvaluation && evaluated.numeric !== null && Number.isFinite(evaluated.numeric)
              ? String(evaluated.numeric)
              : current
          return encloseExpressionInFunction(baseExpression, 'sqrt')
        })
        setLastActionWasEvaluation(false)
        return
      case 'cbrt(':
        setExpression((current) => {
          const baseExpression =
            lastActionWasEvaluation && evaluated.numeric !== null && Number.isFinite(evaluated.numeric)
              ? String(evaluated.numeric)
              : current
          return encloseExpressionInFunction(baseExpression, 'cbrt')
        })
        setLastActionWasEvaluation(false)
        return
      case 'nthRoot(':
        setExpression((current) => {
          const baseExpression =
            lastActionWasEvaluation && evaluated.numeric !== null && Number.isFinite(evaluated.numeric)
              ? String(evaluated.numeric)
              : current
          return encloseExpressionInFunction(baseExpression, 'nthRoot', {
            closeExpression: false,
            suffix: ', ',
          })
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
  const scientificKeys = [
    ['(', ')', 'mc', 'm+', 'm-', 'mr', 'backspace', 'AC', '%', '/'],
    ['2nd', '^2', '^3', '^', 'e^', '10^', '7', '8', '9', '*'],
    ['reciprocal', 'sqrt(', 'cbrt(', 'nthRoot(', 'ln(', 'log10(', '4', '5', '6', '-'],
    ['!', secondaryActive ? 'asin(' : 'sin(', secondaryActive ? 'acos(' : 'cos(', secondaryActive ? 'atan(' : 'tan(', 'e', '*10^', '1', '2', '3', '+'],
    ['Rand', 'sinh(', 'cosh(', 'tanh(', 'pi', angleMode === 'rad' ? 'Rad' : 'Deg', '+/-', '0', '.', '='],
  ]
  const basicKeys = [
    ['AC', 'backspace', '%', '/'],
    ['7', '8', '9', '*'],
    ['4', '5', '6', '-'],
    ['1', '2', '3', '+'],
    ['+/-', '0', '.', '='],
  ]
  const keys = calculatorMode === 'scientific' ? scientificKeys : basicKeys
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
  const geometryObjectChoices: Array<{
    icon: ReactNode
    kind: GeometryComposerKind
  }> = [
    { icon: <CircleDot size={15} />, kind: 'point' },
    { icon: <Spline size={15} />, kind: 'segment' },
    { icon: <Circle size={15} />, kind: 'circle' },
    { icon: <Spline size={15} />, kind: 'hyperbola' },
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
      <section className={`hyper-window ${canvasVisible ? '' : 'canvas-hidden'}`} aria-label="Hypercalculator">
        <header className="window-bar">
          <div className="window-title">
            <Sparkles size={16} />
            <span>Hypercalculator</span>
          </div>
          <button
            aria-label={canvasVisible ? 'Hide canvas' : 'Show canvas'}
            aria-pressed={!canvasVisible}
            className={`canvas-toggle-button ${canvasVisible ? '' : 'active'}`}
            onClick={() => setCanvasVisible((visible) => !visible)}
            title={canvasVisible ? 'Hide canvas' : 'Show canvas'}
            type="button"
          >
            {canvasVisible ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </header>

        {canvasVisible && (
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
        )}

        <section className={`calculator-deck ${calculatorMode}-mode`}>
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
              aria-pressed={calculatorMode === 'basic'}
              className={calculatorMode === 'basic' ? 'active' : undefined}
              onClick={() => setCalculatorMode('basic')}
              type="button"
            >
              Basic
            </button>
            <button
              aria-pressed={calculatorMode === 'scientific'}
              className={calculatorMode === 'scientific' ? 'active' : undefined}
              onClick={() => setCalculatorMode('scientific')}
              type="button"
            >
              Scientific
            </button>
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

          {calculatorMode === 'scientific' && (
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
          )}

          <div className={`keypad ${calculatorMode}-keypad`} aria-label="Calculator keypad">
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
