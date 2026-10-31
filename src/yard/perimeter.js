import { BoxGeometry, Color, DoubleSide, ExtrudeGeometry, Group, InstancedMesh, Matrix4, Mesh, MeshStandardMaterial, Object3D, Shape, ShapeGeometry } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { YARD } from '../config.js'
import { solidBox } from '../propkit.js'
import { box, matte } from './kit.js'

// What rings the yard: the post-and-rail fence, then to the west the railroad
// and the road. All instanced: a couple of hundred pieces, a handful of draw calls.
const dummy = new Object3D()
const unit = new BoxGeometry(1, 1, 1)
const HIDDEN = new Matrix4().makeScale(0, 0, 0)

function instanced(scene, mat, count, shadow = true) {
  const m = new InstancedMesh(unit, mat, count)
  m.castShadow = shadow
  m.receiveShadow = true
  scene.add(m)
  return m
}
function set(mesh, i, x, y, z, sx, sy, sz, yaw = 0, roll = 0) {
  dummy.position.set(x, y, z)
  dummy.rotation.set(0, yaw, roll)
  dummy.scale.set(sx, sy, sz)
  dummy.updateMatrix()
  mesh.setMatrixAt(i, dummy.matrix)
}

function buildFence(scene, remote) {
  const { fence: F } = YARD
  const posts = []
  const rails = []
  // A gate opening splits the fence segment it sits in.
  const pts = []
  // The Leaderboard fills a gap in the south fence, and only the player's own yard has one.
  const points = remote ? [...F.points, F.points[0]] : F.points
  points.forEach((p, i) => {
    pts.push(p)
    const q = points[i + 1]
    if (!q) return
    const dir = Math.sign(q[1] - p[1])
    const inside = F.gates.filter((G) => p[0] === G.x && q[0] === G.x && Math.min(p[1], q[1]) < G.z && G.z < Math.max(p[1], q[1]))
    inside.sort((a, b) => (a.z - b.z) * dir)
    for (const G of inside) pts.push([G.x, G.z - (dir * G.width) / 2, 'end'], [G.x, G.z + (dir * G.width) / 2, 'start'])
  })
  // `on(stage)` = whether a run stands with that many strips of forest bought; the rest always do.
  const moving = []
  function run(ax, az, bx, bz, on = null) {
    const len = Math.hypot(bx - ax, bz - az)
    const yaw = Math.atan2(-(bz - az), bx - ax)
    const spans = Math.max(1, Math.round(len / F.spacing))
    for (let s = 0; s < spans; s++) {
      const t0 = s / spans
      const t1 = (s + 1) / spans
      const px = ax + (bx - ax) * t0
      const pz = az + (bz - az) * t0
      posts.push([px, pz, yaw, on])
      const span = (len / spans) * 1.02
      const cx = ax + ((bx - ax) * (t0 + t1)) / 2
      const cz = az + ((bz - az) * (t0 + t1)) / 2
      for (const y of F.rails) rails.push([cx, y, cz, span, yaw, on])
    }
    const wall = solidBox(len / 2 + 0.3, F.block / 2, 0.25, (ax + bx) / 2, F.block / 2, (az + bz) / 2, yaw)
    if (on) moving.push({ wall, on })
  }
  const [[east, north], [, south]] = F.points.slice(5)
  for (let i = 0; i < pts.length - 1; i++) {
    if (pts[i][2] === 'end') continue // across the opening
    const [ax, az] = pts[i]
    const [bx, bz] = pts[i + 1]
    if (ax !== east || bx !== east) run(ax, az, bx, bz)
  }
  // The east side stands at the edge of the land bought, and the north and south sides run out to
  // it. Corners: each east side starts on its north one, each south side on its east one.
  const edges = [east, ...YARD.forest.parcels.map((p) => p.east)]
  edges.forEach((x, stage) => {
    run(x, north, x, south, (now) => now === stage)
    if (!stage) return
    run(edges[stage - 1], north, x, north, (now) => now >= stage)
    run(x, south, edges[stage - 1], south, (now) => now >= stage)
  })
  const postMesh = instanced(scene, matte(F.post), posts.length)
  const railMesh = instanced(scene, matte(F.rail), rails.length)
  const placePost = (i) => set(postMesh, i, posts[i][0], F.height / 2, posts[i][1], 0.34, F.height, 0.34, posts[i][2])
  const placeRail = (i) => set(railMesh, i, rails[i][0], rails[i][1], rails[i][2], rails[i][3], 0.2, 0.1, rails[i][4])
  posts.forEach((_, i) => placePost(i))
  rails.forEach((_, i) => placeRail(i))
  // Taken with every run in place, or the mesh is culled by where the first stage's fence stands.
  postMesh.computeBoundingSphere()
  railMesh.computeBoundingSphere()
  for (const G of F.gates) buildGate(scene, F, G)

  const fence = {
    setStage(stage) {
      posts.forEach(([, , , on], i) => {
        if (!on) return
        if (on(stage)) placePost(i)
        else postMesh.setMatrixAt(i, HIDDEN)
      })
      rails.forEach((rail, i) => {
        const on = rail[5]
        if (!on) return
        if (on(stage)) placeRail(i)
        else railMesh.setMatrixAt(i, HIDDEN)
      })
      postMesh.instanceMatrix.needsUpdate = railMesh.instanceMatrix.needsUpdate = true
      for (const { wall, on } of moving) wall.setEnabled(on(stage))
    },
  }
  fence.setStage(0)
  return fence
}

// Two gate leaves hinged on tall posts either side of the opening, swung open to the east
// (into the yard) so they stand nearly square to the fence.
function buildGate(scene, F, G) {
  const wood = matte(F.post)
  const plank = matte(F.rail)
  const group = new Group()
  const leaf = 2.9
  for (const side of [-1, 1]) {
    const hz = G.z + side * (G.width / 2 + 0.17)
    box(group, wood, 0.5, F.height + 0.45, 0.5, G.x, (F.height + 0.45) / 2, hz)
    box(group, wood, 0.58, 0.1, 0.58, G.x, F.height + 0.5, hz)
    // The leaf runs east from the post, leaning a little away from the opening.
    const leafGroup = new Group()
    leafGroup.position.set(G.x + 0.25, 0, hz)
    leafGroup.rotation.y = -side * 0.18
    for (const y of [0.3, 0.75, 1.2]) box(leafGroup, plank, leaf, 0.2, 0.1, 0, y, 0).position.x = leaf / 2
    box(leafGroup, wood, 0.14, 1.4, 0.12, leaf, 0.75, 0)
    box(leafGroup, wood, Math.hypot(leaf, 0.9), 0.12, 0.08, leaf / 2, 0.75, 0, 0, 0, Math.atan2(0.9, leaf))
    group.add(leafGroup)
  }
  scene.add(group)
}

export function buildRailroad(scene) {
  const { rail: R } = YARD
  const count = Math.floor(R.length / R.sleeperGap)
  const sleepers = instanced(scene, matte(R.sleeper), count, false)
  for (let i = 0; i < count; i++) {
    set(sleepers, i, R.x, 0.05, (i - count / 2) * R.sleeperGap, R.gauge + 1.1, 0.1, 0.52)
  }
  const steel = instanced(scene, matte(R.steel, { roughness: 0.4, metalness: 0.3 }), 4, false)
  set(steel, 0, R.x - R.gauge / 2, 0.16, 0, 0.14, 0.12, R.length)
  set(steel, 1, R.x + R.gauge / 2, 0.16, 0, 0.14, 0.12, R.length)
  set(steel, 2, R.x - R.gauge / 2, 0.11, 0, 0.26, 0.03, R.length)
  set(steel, 3, R.x + R.gauge / 2, 0.11, 0, 0.26, 0.03, R.length)
}

function buildRoad(scene) {
  const { road: R } = YARD
  const step = R.dashLength + R.dashGap
  const count = Math.floor(R.length / step)
  const dashes = instanced(scene, matte(R.dashColor), count, false)
  const x = (R.west + R.east) / 2
  for (let i = 0; i < count; i++) set(dashes, i, x, 0.012, (i - count / 2) * step, 0.26, 0.02, R.dashLength)
  dashes.material.emissive = new Color(R.dashColor)
  dashes.material.emissiveIntensity = 0.2
  const edges = instanced(scene, matte(R.edgeColor), 2, false)
  set(edges, 0, R.west + R.edgeInset, 0.012, 0, 0.22, 0.02, R.length)
  set(edges, 1, R.east - R.edgeInset, 0.012, 0, 0.22, 0.02, R.length)
}

// Each gate's drive to the road and the deck over the rails. The tarmac sits on the lawn by
// polygon offset, not height, so the road carries on level into it.
function buildDrives(scene) {
  const { road: R, fence: F, rail } = YARD
  const { drive: D, crossing: X } = R
  const flats = []
  const decks = []
  const strokes = []
  const stroke = (w, x, y, z, d) => strokes.push(new BoxGeometry(w, 0.02, d).translate(x, y, z).toNonIndexed())
  for (const G of F.gates) {
    const w = G.width / 2
    const flat = new Shape()
    flat.moveTo(R.east + 0.01, -w - D.flare)
    flat.lineTo(D.flareFrom, -w)
    flat.lineTo(G.x + 0.5, -w)
    flat.lineTo(G.x + 0.5, w)
    flat.lineTo(D.flareFrom, w)
    flat.lineTo(R.east + 0.01, w + D.flare)
    flat.closePath()
    flats.push(new ShapeGeometry(flat).rotateX(Math.PI / 2).translate(0, 0.016, G.z).toNonIndexed())
    const deck = new Shape()
    deck.moveTo(X.from, 0)
    deck.lineTo(X.top, X.height)
    deck.lineTo(X.end, X.height)
    deck.lineTo(X.to, 0)
    deck.closePath()
    decks.push(new ExtrudeGeometry(deck, { depth: G.width, bevelEnabled: false }).translate(0, 0, G.z - w))
    // The grooves the rails run in, and a stop line either side.
    for (const x of [rail.x - rail.gauge / 2, rail.x + rail.gauge / 2]) stroke(0.26, x, X.height + 0.005, G.z, G.width)
    stroke(0.5, X.from - 0.5, 0.02, G.z, G.width)
    stroke(0.5, X.to + 0.1, 0.02, G.z, G.width)
  }
  const tar = new MeshStandardMaterial({ color: R.color, roughness: 0.9, side: DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })
  const parts = [new Mesh(mergeGeometries(flats), tar), new Mesh(mergeGeometries(decks), matte(X.color, { roughness: 0.85 })), new Mesh(mergeGeometries(strokes), matte(X.line))]
  for (const m of parts) m.receiveShadow = true
  scene.add(...parts)
}

// A neighbour's yard has its own fence and drives but shares the road and rails.
export function buildPerimeter(scene, remote = false) {
  const fence = buildFence(scene, remote)
  if (!remote) {
    buildRailroad(scene)
    buildRoad(scene)
  }
  buildDrives(scene)
  return fence
}
