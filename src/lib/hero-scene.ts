import { hexToRgb, type RGB } from "./colors.ts"
import { LOGO_GRID, logoColors, type Tier } from "./logo.ts"
import { onThemeChange } from "./theme.ts"

// The home page hero:
// a pixel landscape where scattered notes gather into the monolith, which then floats over a lake.
// The scene is drawn at one scene pixel per `PIXEL` CSS pixels into a small canvas scaled up crisply,
// and every colour derives from the active theme.

const PIXEL = 4
const SKY_LEVELS = 6

// Intro timeline, in milliseconds of scene time.
const GATHER = 300
const SPREAD = 1400
const FLIGHT = 900
const FLIGHT_JITTER = 700
const WRITE_AT = 3900
const WRITE_FOR = 700
const GLOW_AT = 4400
const GLOW_FOR = 900
const INTRO_END = 5400

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16)

const NOTE_NAMES = [
    "Stoicism.md",
    "Reading list.md",
    "todo.txt",
    "Sourdough.md",
    "Trip to Kyoto.md",
    "Ideas.md",
    "Books.base",
    "Garden plan.md",
    "Dreams.md",
    "Rust ownership.md",
    "Recipes.base",
    "Weekly review.md",
]

const CELLS = LOGO_GRID.cells
const LOGO_MIN_X = Math.min(...CELLS.map((cell) => cell.x))
const LOGO_MAX_X = Math.max(...CELLS.map((cell) => cell.x))
const INSCRIPTION = CELLS.flatMap((cell, index) => (cell.color === "inscription" ? [index] : []))

// What the static scenery holds at each scene pixel.
const SKY = 0
const FAR = 1
const NEAR = 2
const MOON = 3

const WHITE: RGB = [255, 255, 255]
const BLACK: RGB = [0, 0, 0]

interface Rect {
    x0: number
    y0: number
    x1: number
    y1: number
}

interface Layout {
    cols: number
    rows: number
    /** CSS pixels per scene pixel. */
    scale: number
    narrow: boolean
    /** First water row. */
    horizon: number
    /** Scene pixels per logo cell. */
    k: number
    cx: number
    monoLeft: number
    monoTop: number
    stage: Rect
    copy: Rect
}

interface Palette {
    dark: boolean
    bg: number
    sky: number[]
    far: number
    near: number
    water: RGB
    waterDeep: RGB
    shimmer: RGB
    starDim: number
    starBright: number
    moon: number
    moonHalo: RGB
    cloud: number
    cloudShade: number
    glow: RGB
    glowMax: number
    mote: number
    halo: RGB
    haloAmount: number
    logo: Record<Tier, number>
    flash: number
    rune: number
}

interface Star {
    x: number
    y: number
    bright: boolean
    phase: number
    speed: number
}

interface Cloud {
    x: number
    y: number
    w: number
    speed: number
}

interface Streak {
    x: number
    row: number
    len: number
    phase: number
    speed: number
}

/** A note flying into its cell of the monolith during the intro. */
interface Mote {
    cell: number
    fx: number
    fy: number
    bend: number
    appear: number
    start: number
    duration: number
    x: number
    y: number
}

/** A note wandering around the lake once the monolith stands. */
interface Firefly {
    fx: number
    fy: number
    ax: number
    ay: number
    wx: number
    wy: number
    phase: number
    blinkSpeed: number
    born: number
    label: string
    x: number
    y: number
    on: boolean
}

interface Link {
    a: number
    b: number
    until: number
}

interface Elements {
    host: HTMLElement
    hero: HTMLElement
    canvas: HTMLCanvasElement
    ctx: CanvasRenderingContext2D
    tag: HTMLElement
    stage: HTMLElement
    copy: HTMLElement
}

function seeded(seed: number): () => number {
    let state = seed >>> 0
    return () => {
        state = (state + 0x6d2b79f5) >>> 0
        let t = state
        t = Math.imul(t ^ (t >>> 15), t | 1)
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
const bayer = (x: number, y: number) => BAYER[(y & 3) * 4 + (x & 3)]
const ease = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - (-2 * p + 2) ** 3 / 2)

function mix(a: RGB, b: RGB, t: number): RGB {
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
}

/** Packs a colour as ImageData's little-endian RGBA word. */
function pack([r, g, b]: RGB): number {
    return (0xff000000 | (Math.round(b) << 16) | (Math.round(g) << 8) | Math.round(r)) >>> 0
}

function blendTo(color: number, [r, g, b]: RGB, t: number): number {
    const cr = color & 255
    const cg = (color >>> 8) & 255
    const cb = (color >>> 16) & 255
    return pack([cr + (r - cr) * t, cg + (g - cg) * t, cb + (b - cb) * t])
}

function luminance([r, g, b]: RGB): number {
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
}

function toHex(color: RGB): string {
    return `#${color.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`
}

function readColor(probe: CanvasRenderingContext2D | null, name: string, fallback: RGB): RGB {
    const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
    if (!value) return fallback
    if (!probe) return value.startsWith("#") ? hexToRgb(value) : fallback
    probe.clearRect(0, 0, 1, 1)
    probe.fillStyle = "#000"
    probe.fillStyle = value
    probe.fillRect(0, 0, 1, 1)
    const [r, g, b] = probe.getImageData(0, 0, 1, 1).data
    return [r, g, b]
}

function buildPalette(probe: CanvasRenderingContext2D | null): Palette {
    const bg = readColor(probe, "--dl-bg", [249, 249, 249])
    const fg = readColor(probe, "--dl-fg", [0, 0, 0])
    const accent = readColor(probe, "--dl-accent", [30, 141, 255])
    const dark = luminance(bg) < 0.45
    const skyMax = dark ? 0.36 : 0.28
    const horizon = mix(bg, accent, skyMax * 0.7)
    const ink = dark ? mix(bg, BLACK, 0.5) : mix(fg, accent, 0.25)
    const near = mix(horizon, ink, dark ? 0.9 : 0.42)
    const cloud = mix(bg, WHITE, 0.7)
    const logoHex = logoColors(toHex(accent))
    return {
        dark,
        bg: pack(bg),
        sky: Array.from({ length: SKY_LEVELS + 1 }, (_, level) =>
            pack(mix(bg, accent, (level / SKY_LEVELS) * skyMax)),
        ),
        far: pack(mix(horizon, ink, dark ? 0.55 : 0.2)),
        near: pack(near),
        water: mix(horizon, ink, dark ? 0.25 : 0.06),
        waterDeep: dark ? mix(horizon, ink, 0.7) : mix(horizon, mix(accent, ink, 0.3), 0.4),
        shimmer: dark ? mix(horizon, fg, 0.3) : mix(horizon, WHITE, 0.75),
        starDim: pack(mix(bg, fg, 0.35)),
        starBright: pack(mix(bg, fg, 0.85)),
        moon: pack(mix(fg, WHITE, 0.5)),
        moonHalo: mix(fg, accent, 0.5),
        cloud: pack(cloud),
        cloudShade: pack(mix(cloud, accent, 0.12)),
        glow: dark ? mix(accent, WHITE, 0.15) : accent,
        glowMax: dark ? 0.45 : 0.2,
        mote: pack(dark ? mix(accent, WHITE, 0.55) : mix(accent, fg, 0.15)),
        halo: accent,
        haloAmount: dark ? 0.4 : 0.22,
        logo: {
            light: pack(hexToRgb(logoHex.light)),
            top: pack(hexToRgb(logoHex.top)),
            right: pack(hexToRgb(logoHex.right)),
            left: pack(hexToRgb(logoHex.left)),
            inscription: pack(hexToRgb(logoHex.inscription)),
        },
        flash: pack(dark ? WHITE : mix(accent, WHITE, 0.5)),
        rune: pack(accent),
    }
}

class HeroScene {
    private readonly els: Elements
    private readonly probe: CanvasRenderingContext2D | null
    private readonly reduced = window.matchMedia("(prefers-reduced-motion: reduce)")
    private layout: Layout
    private palette: Palette
    private image: ImageData
    private fb: Uint32Array
    private kinds = new Uint8Array(0)
    private base = new Uint32Array(0)
    private moon: { x: number; y: number; r: number } | null = null
    private stars: Star[] = []
    private clouds: Cloud[] = []
    private streaks: Streak[] = []
    private mist = new Float32Array(0)
    private mistRows = 0
    private readonly motes: Mote[]
    private readonly landed: Float64Array
    private readonly runeUntil: Float64Array
    private readonly fireflies: Firefly[]
    private links: Link[] = []
    private hovered = -1
    private time = 0
    private last = 0
    private frame = 0
    private visible = true

    constructor(els: Elements) {
        this.els = els
        this.probe = document.createElement("canvas").getContext("2d", { willReadFrequently: true })
        this.palette = buildPalette(this.probe)
        this.layout = this.measure()
        this.image = els.ctx.createImageData(this.layout.cols, this.layout.rows)
        this.fb = new Uint32Array(this.image.data.buffer)

        this.landed = new Float64Array(CELLS.length).fill(Number.NaN)
        this.runeUntil = new Float64Array(CELLS.length)
        this.motes = CELLS.map((_, cell) => {
            const appear = Math.random() * 600
            return {
                cell,
                fx: Math.random(),
                fy: Math.random(),
                bend: (Math.random() - 0.5) * 2,
                appear,
                start: GATHER + appear + Math.random() * SPREAD,
                duration: FLIGHT + Math.random() * FLIGHT_JITTER,
                x: Number.NaN,
                y: Number.NaN,
            }
        })
        this.fireflies = Array.from({ length: 12 }, (_, i) => ({
            fx: 0,
            fy: 0,
            ax: 2 + Math.random() * 6,
            ay: 1 + Math.random() * 3,
            wx: 0.3 + Math.random() * 0.5,
            wy: 0.4 + Math.random() * 0.6,
            phase: Math.random() * Math.PI * 2,
            blinkSpeed: 0.5 + Math.random() * 0.7,
            born: GLOW_AT + i * 280,
            label: "",
            x: Number.NaN,
            y: Number.NaN,
            on: false,
        }))
        for (const firefly of this.fireflies) this.placeFirefly(firefly)
    }

    start(): void {
        this.resize()
        this.listen()
        this.sync()
    }

    private listen(): void {
        new ResizeObserver(() => {
            this.resize()
            if (!this.frame) this.render()
        }).observe(this.els.host)
        new IntersectionObserver(([entry]) => {
            this.visible = entry?.isIntersecting ?? true
            this.sync()
        }).observe(this.els.host)
        document.addEventListener("visibilitychange", () => this.sync())
        this.reduced.addEventListener("change", () => this.sync())
        onThemeChange(() => {
            this.palette = buildPalette(this.probe)
            this.paintBase()
            if (!this.frame) this.render()
        })
        this.els.hero.addEventListener("pointermove", (event) => this.hover(event))
        this.els.hero.addEventListener("pointerleave", () => this.release())
    }

    private sync(): void {
        if (this.reduced.matches) {
            // Skip straight to the finished, still scene.
            this.landed.fill(Number.NEGATIVE_INFINITY)
            this.time = Math.max(this.time, INTRO_END + 1500)
        }
        const run = this.visible && document.visibilityState === "visible" && !this.reduced.matches
        if (run && !this.frame) {
            this.last = performance.now()
            this.frame = requestAnimationFrame(this.tick)
        } else if (!run && this.frame) {
            cancelAnimationFrame(this.frame)
            this.frame = 0
        }
        if (!this.frame) this.render()
    }

    private readonly tick = (now: number): void => {
        this.frame = requestAnimationFrame(this.tick)
        const step = this.time < INTRO_END ? 1000 / 30 : 1000 / 20
        const elapsed = now - this.last
        if (elapsed < step) return
        this.last = now
        this.time += Math.min(elapsed, 100)
        this.render()
    }

    private measure(): Layout {
        const box = this.els.host.getBoundingClientRect()
        const dpr = window.devicePixelRatio || 1
        const scale = Math.max(1, Math.round(PIXEL * dpr)) / dpr
        const cols = Math.max(1, Math.ceil(box.width / scale))
        const rows = Math.max(1, Math.ceil(box.height / scale))
        const toScene = (rect: DOMRect): Rect => ({
            x0: (rect.left - box.left) / scale,
            y0: (rect.top - box.top) / scale,
            x1: (rect.right - box.left) / scale,
            y1: (rect.bottom - box.top) / scale,
        })
        const stage = toScene(this.els.stage.getBoundingClientRect())
        const copy = toScene(this.els.copy.getBoundingClientRect())
        const horizon = clamp(Math.round(stage.y1), 1, rows - 1)
        const k = clamp(Math.floor((stage.y1 - stage.y0 - 3) / (LOGO_GRID.height + 2)), 1, 4)
        const cx = Math.round((stage.x0 + stage.x1) / 2)
        return {
            cols,
            rows,
            scale,
            narrow: box.width < 52 * 16,
            horizon,
            k,
            cx,
            monoLeft: cx - Math.round(((LOGO_MIN_X + LOGO_MAX_X + 1) * k) / 2),
            monoTop: horizon - (2 * k + 2) - LOGO_GRID.height * k,
            stage,
            copy,
        }
    }

    private resize(): void {
        this.layout = this.measure()
        const { cols, rows, scale } = this.layout
        const { canvas, ctx } = this.els
        if (canvas.width !== cols || canvas.height !== rows) {
            canvas.width = cols
            canvas.height = rows
            this.image = ctx.createImageData(cols, rows)
            this.fb = new Uint32Array(this.image.data.buffer)
        }
        canvas.style.width = `${cols * scale}px`
        canvas.style.height = `${rows * scale}px`
        this.placeScenery()
        this.paintBase()
    }

    /** Lays out the hills, pines, moon, stars, clouds and ripples for this size. */
    private placeScenery(): void {
        const { cols, rows, horizon, k, cx, narrow, stage, copy } = this.layout
        const rnd = seeded(7)
        const kinds = new Uint8Array(cols * rows)
        const set = (x: number, y: number, kind: number) => {
            if (x >= 0 && x < cols && y >= 0 && y < horizon) kinds[y * cols + x] = kind
        }

        const ridgeMax = Math.max(3, Math.round((stage.y1 - stage.y0) * 0.1))
        const [p1, p2, p3] = [rnd() * 6, rnd() * 6, rnd() * 6]
        for (let x = 0; x < cols; x += 1) {
            const wave =
                0.55 +
                0.25 * Math.sin(x * 0.045 + p1) +
                0.12 * Math.sin(x * 0.11 + p2) +
                0.08 * Math.sin(x * 0.29 + p3)
            const height = Math.round(ridgeMax * wave)
            for (let y = horizon - height; y < horizon; y += 1) set(x, y, FAR)
        }

        const pine = (px: number, height: number) => {
            const tier = Math.max(3, Math.round(height / 4))
            const trunk = Math.max(1, Math.round(height * 0.1))
            for (let r = 0; r < height; r += 1) {
                const half = r >= height - trunk ? 0 : Math.floor((r % tier) * 0.7 + r * 0.2)
                for (let dx = -half; dx <= half; dx += 1) set(px + dx, horizon - height + r, NEAR)
            }
        }
        const edge = Math.round(cols * (narrow ? 0.16 : 0.11))
        for (const left of [true, false]) {
            const from = left ? -2 * k : cols - edge
            const to = left ? edge : cols + 2 * k
            for (let x = from; x < to; x += (2 + rnd() * 2.5) * k) {
                const towardEdge = left ? 1 - x / edge : (x - (cols - edge)) / edge
                pine(Math.round(x), Math.round((6 + rnd() * 5 + clamp(towardEdge, 0, 1) * 8) * k))
            }
            for (let x = from; x < to; x += 1) {
                for (let y = horizon - k; y < horizon; y += 1) set(x, y, NEAR)
            }
        }

        this.moon = null
        if (!narrow) {
            const r = 2 + Math.floor(k / 2)
            const monoWidth = (LOGO_MAX_X - LOGO_MIN_X + 1) * k
            const moon = {
                x: Math.min(cols - 4 * r, cx + Math.round(monoWidth * 0.95)),
                y: Math.max(3 * r, Math.round(stage.y0 + 3 * r)),
                r,
            }
            for (let y = moon.y - r; y <= moon.y + r; y += 1) {
                for (let x = moon.x - r; x <= moon.x + r; x += 1) {
                    if ((x - moon.x) ** 2 + (y - moon.y) ** 2 <= r * r + r) set(x, y, MOON)
                }
            }
            this.moon = moon
        }
        this.kinds = kinds

        const inCopy = (x: number, y: number, pad: number) =>
            x > copy.x0 - pad && x < copy.x1 + pad && y > copy.y0 - pad && y < copy.y1 + pad
        const nearMoon = (x: number, y: number) =>
            this.moon !== null && Math.hypot(x - this.moon.x, y - this.moon.y) < this.moon.r * 3.4
        this.stars = []
        const starCount = Math.round((cols * horizon) / 200)
        for (let i = 0; i < starCount; i += 1) {
            const x = Math.floor(rnd() * cols)
            const y = Math.floor(rnd() * horizon * 0.85)
            const bright = rnd() < 0.25
            const phase = rnd() * Math.PI * 2
            const speed = 0.6 + rnd() * 1.6
            if (kinds[y * cols + x] !== SKY || nearMoon(x, y)) continue
            if (inCopy(x, y, 4) && rnd() < 0.9) continue
            this.stars.push({ x, y, bright, phase, speed })
        }

        this.clouds = []
        const cloudTop = narrow ? copy.y1 + 3 : horizon * 0.15
        const cloudBottom = horizon - ridgeMax - 6
        if (cloudBottom - cloudTop > 4) {
            for (let i = 0; i < (narrow ? 2 : 4); i += 1) {
                this.clouds.push({
                    x: rnd() * cols,
                    y: Math.round(cloudTop + rnd() * (cloudBottom - cloudTop)),
                    w: Math.round((10 + rnd() * 14) * Math.max(1, k * 0.6)),
                    speed: 0.4 + rnd() * 0.8,
                })
            }
        }

        const waterRows = rows - horizon
        this.mistRows = Math.min(Math.round(waterRows * 0.45), 26)
        this.streaks = Array.from({ length: Math.round((cols * waterRows) / 45) }, () => ({
            x: Math.floor(rnd() * cols),
            row: 1 + Math.floor(rnd() * Math.max(1, waterRows - this.mistRows)),
            len: 2 + Math.floor(rnd() * (2 * k + 1)),
            phase: rnd() * Math.PI * 2,
            speed: 0.6 + rnd() * 1.4,
        }))

        const [q1, q2, q3] = [rnd() * 6, rnd() * 6, rnd() * 6]
        this.mist = Float32Array.from(
            { length: cols },
            (_, x) =>
                0.5 * Math.sin(x * 0.13 + q1) +
                0.3 * Math.sin(x * 0.37 + q2) +
                0.2 * Math.sin(x * 0.71 + q3),
        )
    }

    /** Paints the still scenery (sky, hills, moon) in the current theme. */
    private paintBase(): void {
        const { cols, rows, horizon, cx } = this.layout
        const P = this.palette
        const base = new Uint32Array(cols * rows)
        const spread = cols * 0.22
        const moon = P.dark ? this.moon : null
        for (let y = 0; y < horizon; y += 1) {
            const t = (y + 1) / horizon
            const ambient = t ** 2.4 * 0.6
            const lift = t ** 3 * 0.45
            for (let x = 0; x < cols; x += 1) {
                const i = y * cols + x
                const kind = this.kinds[i]
                if (kind === FAR) base[i] = P.far
                else if (kind === NEAR) base[i] = P.near
                else if (kind === MOON && moon) base[i] = P.moon
                else {
                    const glow = Math.exp(-(((x - cx) / spread) ** 2))
                    const level = Math.min(1, ambient + glow * lift) * SKY_LEVELS
                    let step = Math.floor(level)
                    if (level - step > bayer(x, y)) step += 1
                    let color = P.sky[Math.min(step, SKY_LEVELS)]
                    if (moon) {
                        const d = Math.hypot(x - moon.x, y - moon.y) / (moon.r * 3.4)
                        if (d < 1) {
                            const amount = Math.floor((1 - d) * 0.5 * 4 + bayer(x, y)) / 4
                            if (amount > 0) color = blendTo(color, P.moonHalo, amount)
                        }
                    }
                    base[i] = color
                }
            }
        }
        this.base = base
    }

    private render(): void {
        const { k, horizon } = this.layout
        const t = this.time
        this.fb.set(this.base)
        if (this.palette.dark) this.drawStars()
        else this.drawClouds()
        const bob = t < GLOW_AT ? 0 : Math.round(Math.sin(((t - GLOW_AT) / 3600) * Math.PI * 2) * k)
        const glow = clamp((t - GLOW_AT) / GLOW_FOR, 0, 1) * (0.85 + 0.15 * Math.sin(t / 900))
        if (glow > 0) this.drawGlow(bob, glow)
        this.drawMonolith(bob)
        this.update()
        // Sprites are drawn before the water so the lake reflects them, then again over it.
        this.drawSprites(0)
        this.drawWater()
        this.drawSprites(horizon)
        this.drawMist()
        this.els.ctx.putImageData(this.image, 0, 0)
        this.placeTag()
    }

    private drawStars(): void {
        const { cols } = this.layout
        const P = this.palette
        for (const star of this.stars) {
            const wave = Math.sin((this.time * star.speed) / 1000 + star.phase)
            if (wave < -0.6) continue
            this.fb[star.y * cols + star.x] = star.bright || wave > 0.7 ? P.starBright : P.starDim
        }
    }

    private drawClouds(): void {
        const { cols } = this.layout
        const P = this.palette
        for (const cloud of this.clouds) {
            const span = cols + cloud.w * 2
            const left =
                Math.round((((cloud.x + (this.time * cloud.speed) / 1000) % span) + span) % span) -
                cloud.w
            const band = Math.max(1, Math.round(cloud.w / 8))
            const shapes: [number, number, number][] = [
                [0, 0.3, 0.62],
                [band, 0.12, 0.85],
                [2 * band, 0, 1],
            ]
            for (const [dy, from, to] of shapes) {
                for (let r = 0; r < band; r += 1) {
                    const y = cloud.y + dy + r
                    const color = dy === 2 * band && r === band - 1 ? P.cloudShade : P.cloud
                    for (
                        let x = left + Math.round(cloud.w * from);
                        x < left + cloud.w * to;
                        x += 1
                    ) {
                        if (x >= 0 && x < cols && this.kinds[y * cols + x] === SKY) {
                            this.fb[y * cols + x] = color
                        }
                    }
                }
            }
        }
    }

    private drawGlow(bob: number, strength: number): void {
        const { cols, horizon, k, cx, monoTop } = this.layout
        const P = this.palette
        const radius = LOGO_GRID.height * k * 0.75
        const cy = monoTop + bob + (LOGO_GRID.height * k) / 2
        const y0 = Math.max(0, Math.floor(cy - radius))
        const y1 = Math.min(horizon - 1, Math.ceil(cy + radius))
        const x0 = Math.max(0, Math.floor(cx - radius))
        const x1 = Math.min(cols - 1, Math.ceil(cx + radius))
        for (let y = y0; y <= y1; y += 1) {
            for (let x = x0; x <= x1; x += 1) {
                const d = Math.hypot(x - cx, y - cy) / radius
                if (d >= 1) continue
                const amount = Math.floor((1 - d) ** 2 * strength * P.glowMax * 4 + bayer(x, y)) / 4
                if (amount > 0)
                    this.fb[y * cols + x] = blendTo(this.fb[y * cols + x], P.glow, amount)
            }
        }
    }

    private drawMonolith(bob: number): void {
        const { cols, horizon, k, monoLeft, monoTop } = this.layout
        const P = this.palette
        const t = this.time
        const written = ((t - WRITE_AT) / WRITE_FOR) * LOGO_GRID.height
        for (const [i, cell] of CELLS.entries()) {
            const landed = this.landed[i]
            if (Number.isNaN(landed)) continue
            let color = P.logo[cell.color]
            if (t - landed < 140) color = P.flash
            else if (cell.color === "inscription") {
                if (this.runeUntil[i] > t) color = P.rune
                else if (cell.y >= written) color = P.logo.left
            }
            const left = monoLeft + cell.x * k
            const top = monoTop + bob + cell.y * k
            for (let y = Math.max(0, top); y < Math.min(horizon, top + k); y += 1) {
                for (let x = Math.max(0, left); x < Math.min(cols, left + k); x += 1) {
                    this.fb[y * cols + x] = color
                }
            }
        }
    }

    /** Moves the motes and fireflies to their positions for the current time. */
    private update(): void {
        const { cols, rows, horizon, k, monoLeft, monoTop, stage, narrow } = this.layout
        const t = this.time
        const spawnTop = horizon - (stage.y1 - stage.y0) * 0.55
        const spawnSpan = rows - this.mistRows - spawnTop

        for (const mote of this.motes) {
            mote.x = Number.NaN
            if (!Number.isNaN(this.landed[mote.cell]) || t < mote.appear) continue
            const sx = mote.fx * cols
            const sy = spawnTop + mote.fy * spawnSpan
            if (t < mote.start) {
                mote.x = sx + Math.sin(t / 280 + mote.bend * 7) * 1.5
                mote.y = sy + Math.cos(t / 330 + mote.fx * 40) * 1.5
                continue
            }
            const p = (t - mote.start) / mote.duration
            if (p >= 1) {
                this.landed[mote.cell] = t
                continue
            }
            const cell = CELLS[mote.cell]
            const tx = monoLeft + cell.x * k + (k - 1) / 2
            const ty = monoTop + cell.y * k + (k - 1) / 2
            const mx = (sx + tx) / 2 - (ty - sy) * mote.bend * 0.35
            const my = (sy + ty) / 2 + (tx - sx) * mote.bend * 0.35
            const e = ease(p)
            mote.x = (1 - e) ** 2 * sx + 2 * (1 - e) * e * mx + e * e * tx
            mote.y = (1 - e) ** 2 * sy + 2 * (1 - e) * e * my + e * e * ty
        }

        // Notes passing close to each other briefly link up, like wiki links.
        this.links = this.links.filter((link) => link.until > t)
        if (t > GATHER && t < WRITE_AT && this.links.length < 8) {
            const a = Math.floor(Math.random() * this.motes.length)
            const from = this.motes[a]
            for (let j = 1; j < 40 && !Number.isNaN(from.x); j += 1) {
                const b = (a + j) % this.motes.length
                const to = this.motes[b]
                if (Number.isNaN(to.x) || Math.hypot(to.x - from.x, to.y - from.y) > 14) continue
                this.links.push({ a, b, until: t + 220 })
                break
            }
        }

        if (t > INTRO_END && INSCRIPTION.length > 0 && Math.random() < 0.06) {
            const rune = INSCRIPTION[Math.floor(Math.random() * INSCRIPTION.length)]
            this.runeUntil[rune] = t + 300 + Math.random() * 500
        }

        const active = narrow ? 7 : this.fireflies.length
        for (const [i, firefly] of this.fireflies.entries()) {
            if (i === this.hovered) continue
            const was = firefly.on
            firefly.on =
                i < active &&
                t > firefly.born &&
                Math.sin((t * firefly.blinkSpeed) / 1000 + firefly.phase) > -0.3
            if (firefly.on && !was) this.placeFirefly(firefly)
            const [bandTop, bandSpan] = this.fireflyBand()
            firefly.x =
                firefly.fx * cols + Math.sin((t * firefly.wx) / 1000 + firefly.phase) * firefly.ax
            firefly.y =
                bandTop +
                firefly.fy * bandSpan +
                Math.cos((t * firefly.wy) / 1000 + firefly.phase) * firefly.ay
        }
    }

    private fireflyBand(): [number, number] {
        const { rows, horizon, stage } = this.layout
        const top = horizon - (stage.y1 - stage.y0) * 0.55
        const bottom = horizon + (rows - horizon - this.mistRows) * 0.6
        return [top, bottom - top]
    }

    /** Moves a firefly somewhere new, away from the copy and the monolith. */
    private placeFirefly(firefly: Firefly): void {
        const { cols, copy, k, monoLeft, monoTop } = this.layout
        const [bandTop, bandSpan] = this.fireflyBand()
        const monoRight = monoLeft + (LOGO_MAX_X + 1) * k
        const monoBottom = monoTop + LOGO_GRID.height * k
        for (let attempt = 0; attempt < 8; attempt += 1) {
            firefly.fx = 0.03 + Math.random() * 0.94
            firefly.fy = Math.random()
            const x = firefly.fx * cols
            const y = bandTop + firefly.fy * bandSpan
            const overCopy =
                x > copy.x0 - 6 && x < copy.x1 + 6 && y > copy.y0 - 6 && y < copy.y1 + 6
            const overMonolith =
                x > monoLeft + LOGO_MIN_X * k - 4 &&
                x < monoRight + 4 &&
                y > monoTop &&
                y < monoBottom
            if (!overCopy && !overMonolith) break
        }
        firefly.label = NOTE_NAMES[Math.floor(Math.random() * NOTE_NAMES.length)]
    }

    private drawSprites(clipTop: number): void {
        const P = this.palette
        for (const mote of this.motes) {
            if (!Number.isNaN(mote.x)) this.spark(mote.x, mote.y, clipTop)
        }
        for (const link of this.links) {
            const a = this.motes[link.a]
            const b = this.motes[link.b]
            if (!Number.isNaN(a.x) && !Number.isNaN(b.x)) {
                this.line(a.x, a.y, b.x, b.y, P.haloAmount + 0.15, clipTop)
            }
        }
        const lit = this.fireflies.filter((firefly) => firefly.on)
        for (const [i, a] of lit.entries()) {
            for (const b of lit.slice(i + 1)) {
                if (Math.hypot(a.x - b.x, a.y - b.y) < 18) {
                    this.line(a.x, a.y, b.x, b.y, P.haloAmount * 0.6, clipTop)
                }
            }
        }
        for (const firefly of lit) this.spark(firefly.x, firefly.y, clipTop)
    }

    private spark(x: number, y: number, clipTop: number): void {
        const P = this.palette
        const px = Math.round(x)
        const py = Math.round(y)
        for (const [dx, dy] of [
            [-1, 0],
            [1, 0],
            [0, -1],
            [0, 1],
        ]) {
            this.blend(px + dx, py + dy, P.halo, P.haloAmount, clipTop)
        }
        const { cols, rows } = this.layout
        if (px >= 0 && px < cols && py >= clipTop && py < rows) this.fb[py * cols + px] = P.mote
    }

    /** A dotted pixel line between two points. */
    private line(x0: number, y0: number, x1: number, y1: number, amount: number, clipTop: number) {
        let x = Math.round(x0)
        let y = Math.round(y0)
        const tx = Math.round(x1)
        const ty = Math.round(y1)
        const dx = Math.abs(tx - x)
        const dy = -Math.abs(ty - y)
        const sx = x < tx ? 1 : -1
        const sy = y < ty ? 1 : -1
        let err = dx + dy
        for (let step = 0; step < 200; step += 1) {
            if (step % 2 === 0) this.blend(x, y, this.palette.halo, amount, clipTop)
            if (x === tx && y === ty) break
            const e2 = 2 * err
            if (e2 >= dy) {
                err += dy
                x += sx
            }
            if (e2 <= dx) {
                err += dx
                y += sy
            }
        }
    }

    private blend(x: number, y: number, color: RGB, amount: number, clipTop: number): void {
        const { cols, rows } = this.layout
        if (x < 0 || x >= cols || y < clipTop || y >= rows) return
        this.fb[y * cols + x] = blendTo(this.fb[y * cols + x], color, amount)
    }

    /** Mirrors the scene above the horizon into a rippling lake. */
    private drawWater(): void {
        const { cols, rows, horizon } = this.layout
        const P = this.palette
        const t = this.time
        const fb = this.fb
        const waterRows = rows - horizon
        for (let y = horizon; y < rows; y += 1) {
            const depth = (y - horizon) / waterRows
            const source = Math.max(0, 2 * horizon - 1 - y)
            const offset = Math.round(Math.sin(y * 0.9 + t * 0.0026) * (0.5 + depth * 2.5))
            const water = mix(P.water, P.waterDeep, depth)
            const calm = Math.sin(y * 1.7 + t * 0.0013) > 0.8
            const strength = y === horizon ? 0.3 : calm ? 0.85 : 0.45 + depth * 0.35
            const tint = y === horizon ? P.shimmer : water
            for (let x = 0; x < cols; x += 1) {
                const sx = clamp(x + offset, 0, cols - 1)
                fb[y * cols + x] = blendTo(fb[source * cols + sx], tint, strength)
            }
        }
        for (const streak of this.streaks) {
            if (Math.sin((t * streak.speed) / 1000 + streak.phase) < 0.55) continue
            const y = horizon + streak.row
            for (let x = streak.x; x < Math.min(cols, streak.x + streak.len); x += 1) {
                fb[y * cols + x] = blendTo(fb[y * cols + x], P.shimmer, 0.6)
            }
        }
    }

    /** Dissolves the bottom of the lake into the page background. */
    private drawMist(): void {
        const { cols, rows } = this.layout
        const start = rows - this.mistRows
        for (let y = Math.max(0, start); y < rows; y += 1) {
            const t = (y - start + 1) / this.mistRows
            for (let x = 0; x < cols; x += 1) {
                if (t * 1.5 - 0.25 + this.mist[x] * 0.25 > bayer(x, y)) {
                    this.fb[y * cols + x] = this.palette.bg
                }
            }
        }
    }

    private hover(event: PointerEvent): void {
        if (this.time < INTRO_END) return
        const rect = this.els.canvas.getBoundingClientRect()
        const x = (event.clientX - rect.left) / this.layout.scale
        const y = (event.clientY - rect.top) / this.layout.scale
        let best = -1
        let bestDistance = this.hovered >= 0 ? 8 : 5
        for (const [i, firefly] of this.fireflies.entries()) {
            if (!firefly.on) continue
            const distance = Math.hypot(firefly.x - x, firefly.y - y)
            if (distance < bestDistance) {
                best = i
                bestDistance = distance
            }
        }
        if (best === this.hovered) return
        this.hovered = best
        if (!this.frame) this.render()
        else this.placeTag()
    }

    private release(): void {
        if (this.hovered < 0) return
        this.hovered = -1
        this.placeTag()
    }

    private placeTag(): void {
        const { tag } = this.els
        const firefly = this.fireflies[this.hovered]
        if (!firefly) {
            tag.hidden = true
            return
        }
        const { scale } = this.layout
        if (tag.textContent !== firefly.label) tag.textContent = firefly.label
        tag.style.left = `${Math.round(firefly.x * scale)}px`
        tag.style.top = `${Math.round(firefly.y * scale)}px`
        tag.hidden = false
    }
}

export function mountHeroScene(host: HTMLElement): void {
    const hero = host.parentElement
    const canvas = host.querySelector("canvas")
    const ctx = canvas?.getContext("2d")
    const tag = host.querySelector<HTMLElement>("[data-hero-tag]")
    const stage = hero?.querySelector<HTMLElement>("[data-hero-stage]")
    const copy = hero?.querySelector<HTMLElement>("[data-hero-copy]")
    if (!hero || !canvas || !ctx || !tag || !stage || !copy) return
    new HeroScene({ host, hero, canvas, ctx, tag, stage, copy }).start()
}
