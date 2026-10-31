import { BackSide, Box3, BufferAttribute, BufferGeometry, CanvasTexture, Color, Group, Matrix3, Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial, NormalBlending, SRGBColorSpace, Sphere, Vector3 } from 'three'

// A neighbour's yard from anywhere but next to it: a photograph in geometry. Everything that stands
// in the yard right now is copied into a mesh or two that share one texture atlas, so a yard of a
// few hundred draw calls takes about three, and the real one (plots.js) leaves the scene altogether.
// Nothing here moves; plots.js bakes again now and then, a few thousand vertices a frame.

// Every picture in a yard, shrunk into one canvas. Each gets a cell the first time it's met.
export function createAtlas(size, cell) {
  const PAD = 3
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, cell, cell) // cell 0: what an unpainted surface samples
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.anisotropy = 4
  const across = Math.floor(size / cell)
  const cells = new Map() // texture -> { x, y, size } in 0..1 (x, y the corner nearest uv 0,0), null if it can't go in
  let next = 1

  function draw(map, at) {
    const y = Math.round((1 - at.y - at.size) * size)
    ctx.clearRect(at.x * size - PAD, y - PAD, cell, cell)
    ctx.drawImage(map.image, Math.round(at.x * size), y, cell - PAD * 2, cell - PAD * 2)
    texture.needsUpdate = true
  }

  return {
    texture,
    white: { u: (cell / 2) / size, v: 1 - (cell / 2) / size },
    cell(map) {
      let at = cells.get(map)
      if (at !== undefined) return at
      at = null
      if (map.image?.width && next < across * across) {
        const col = next % across
        const row = Math.floor(next / across)
        next++
        at = { x: (col * cell + PAD) / size, y: 1 - ((row + 1) * cell - PAD) / size, size: (cell - PAD * 2) / size }
        draw(map, at)
      }
      cells.set(map, at)
      return at
    },
    // Pictures painted again since they went in: the font arriving, say.
    redraw() {
      for (const [map, at] of cells) if (at) draw(map, at)
    },
  }
}

// One merged mesh per way of being drawn. Shared by every bake.
const looks = new Map()
function look(atlas, m) {
  const lit = !!m.isMeshStandardMaterial
  const offset = m.polygonOffset ? m.polygonOffsetFactor : 0
  const key = [lit, m.transparent, m.side, offset, m.depthWrite].join('|')
  let out = looks.get(key)
  if (!out) {
    const Kind = lit ? MeshStandardMaterial : MeshBasicMaterial
    out = new Kind({ map: atlas.texture, vertexColors: true, side: m.side, transparent: m.transparent, depthWrite: m.depthWrite, polygonOffset: !!offset, polygonOffsetFactor: offset, polygonOffsetUnits: offset })
    if (lit) Object.assign(out, { roughness: 0.8, metalness: 0 })
    looks.set(key, out)
  }
  return out
}

// Glows are left out, and so are silhouette rims: back faces blown up in the vertex shader.
const bakeable = (m) => m.visible && m.blending === NormalBlending && m.side !== BackSide && !(m.transparent && m.opacity < 0.98)

function collect(o, skip, pieces) {
  if (!o.visible || skip.has(o)) return
  if (o.isMesh && !o.isSkinnedMesh) {
    const { geometry: geo } = o
    const whole = geo.index ? geo.index.count : geo.attributes.position.count
    const instances = o.isInstancedMesh ? o.count : 1
    if (Array.isArray(o.material)) {
      for (const g of geo.groups) {
        const m = o.material[g.materialIndex]
        if (m && bakeable(m)) pieces.push({ mesh: o, m, start: g.start, count: Math.min(g.count, whole - g.start), instances })
      }
    } else if (bakeable(o.material)) {
      pieces.push({ mesh: o, m: o.material, start: 0, count: whole, instances })
    }
  }
  for (const c of o.children) collect(c, skip, pieces)
}

const rel = new Matrix4()
const at = new Matrix4()
const each = new Matrix4()
const normals = new Matrix3()
const tint = new Color()
const base = new Color()
const made = new Color()
const p = [new Vector3(), new Vector3(), new Vector3()]
const n = new Vector3()
const edgeA = new Vector3()
const edgeB = new Vector3()

function fill(piece, out, inv, atlas) {
  const { mesh, m, start, count } = piece
  const { geometry: geo } = mesh
  const { position, normal, uv, color } = geo.attributes
  const index = geo.index
  const { map } = m
  const cell = map ? atlas.cell(map) : null
  // A picture that tiles can't sit in a cell: the whole surface takes the colour at its middle.
  let solid = !cell || !uv
  if (cell && uv) {
    for (let i = 0; i < uv.count && !solid; i++) {
      const a = uv.getX(i) * map.repeat.x + map.offset.x
      const b = uv.getY(i) * map.repeat.y + map.offset.y
      solid = a < -0.01 || a > 1.01 || b < -0.01 || b > 1.01
    }
  }
  const fixedU = cell ? cell.x + cell.size / 2 : atlas.white.u
  const fixedV = cell ? cell.y + cell.size / 2 : atlas.white.v
  base.copy(m.color ?? tint.set(0xffffff))
  if (m.emissive && m.emissiveIntensity > 0) {
    base.r += m.emissive.r * m.emissiveIntensity
    base.g += m.emissive.g * m.emissiveIntensity
    base.b += m.emissive.b * m.emissiveIntensity
  }

  rel.multiplyMatrices(inv, mesh.matrixWorld)
  const faceNormals = m.flatShading || !normal
  for (let inst = 0; inst < piece.instances; inst++) {
    made.copy(base)
    if (mesh.isInstancedMesh) {
      mesh.getMatrixAt(inst, each)
      at.multiplyMatrices(rel, each)
      if (mesh.instanceColor) {
        mesh.getColorAt(inst, tint)
        made.multiply(tint)
      }
    } else {
      at.copy(rel)
    }
    const det = at.determinant()
    if (Math.abs(det) < 1e-9) continue // scaled to nothing: a felled tree
    normals.getNormalMatrix(at)
    for (let t = start; t + 2 < start + count; t += 3) {
      for (let c = 0; c < 3; c++) {
        // A mirrored object's triangles would otherwise turn their backs.
        const corner = det < 0 && c ? 3 - c : c
        const i = index ? index.getX(t + corner) : t + corner
        p[c].fromBufferAttribute(position, i).applyMatrix4(at)
      }
      if (faceNormals) n.crossVectors(edgeA.subVectors(p[1], p[0]), edgeB.subVectors(p[2], p[0])).normalize()
      for (let c = 0; c < 3; c++) {
        const corner = det < 0 && c ? 3 - c : c
        const i = index ? index.getX(t + corner) : t + corner
        if (!faceNormals) n.fromBufferAttribute(normal, i).applyMatrix3(normals).normalize()
        const { pos, nor, tex, col, box } = out
        const v = out.n++
        pos[v * 3] = p[c].x
        pos[v * 3 + 1] = p[c].y
        pos[v * 3 + 2] = p[c].z
        box.expandByPoint(p[c])
        nor[v * 3] = n.x
        nor[v * 3 + 1] = n.y
        nor[v * 3 + 2] = n.z
        if (solid) {
          tex[v * 2] = fixedU
          tex[v * 2 + 1] = fixedV
        } else {
          let a = uv.getX(i) * map.repeat.x + map.offset.x
          let b = uv.getY(i) * map.repeat.y + map.offset.y
          if (!map.flipY) b = 1 - b
          tex[v * 2] = cell.x + Math.min(1, Math.max(0, a)) * cell.size
          tex[v * 2 + 1] = cell.y + Math.min(1, Math.max(0, b)) * cell.size
        }
        const vc = m.vertexColors && color
        col[v * 3] = made.r * (vc ? color.getX(i) : 1)
        col[v * 3 + 1] = made.g * (vc ? color.getY(i) : 1)
        col[v * 3 + 2] = made.b * (vc ? color.getZ(i) : 1)
      }
    }
  }
}

function finish(out) {
  const geo = new BufferGeometry()
  const free = function () {
    this.array = null // the GPU has it; five yards' worth stays out of the heap
  }
  const attr = (name, array, size) => geo.setAttribute(name, new BufferAttribute(array, size).onUpload(free))
  attr('position', out.pos, 3)
  attr('normal', out.nor, 3)
  attr('uv', out.tex, 2)
  attr('color', out.col, 3)
  geo.setDrawRange(0, out.n)
  geo.boundingSphere = out.box.getBoundingSphere(new Sphere())
  return geo
}

// Starts a bake of `root`, leaving out the objects in `skip`. step(budget) copies about `budget`
// vertices and returns the finished group, in root's own coordinates, once it has them all.
export function bakeYard(root, skip, atlas) {
  root.updateMatrixWorld(true)
  const inv = root.matrixWorld.clone().invert()
  const pieces = []
  for (const c of root.children) collect(c, skip, pieces)
  const outs = new Map() // shared look -> what goes in it
  for (const piece of pieces) {
    const mat = look(atlas, piece.m)
    if (!outs.has(mat)) outs.set(mat, { n: 0, size: 0, box: new Box3() })
    piece.out = outs.get(mat)
    piece.out.size += Math.floor(piece.count / 3) * 3 * piece.instances
  }
  for (const out of outs.values()) {
    out.pos = new Float32Array(out.size * 3)
    out.nor = new Float32Array(out.size * 3)
    out.tex = new Float32Array(out.size * 2)
    out.col = new Float32Array(out.size * 3)
  }
  let next = 0
  return {
    step(budget) {
      let done = 0
      while (next < pieces.length && done < budget) {
        const piece = pieces[next++]
        fill(piece, piece.out, inv, atlas)
        done += piece.count * piece.instances
      }
      if (next < pieces.length) return null
      const group = new Group()
      for (const [mat, out] of outs) {
        if (!out.n) continue
        const mesh = new Mesh(finish(out), mat)
        mesh.receiveShadow = true
        group.add(mesh)
      }
      return group
    },
  }
}

export function disposeBake(group) {
  for (const mesh of group.children) mesh.geometry.dispose()
}
