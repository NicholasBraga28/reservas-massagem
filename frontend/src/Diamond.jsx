import { useThreeCanvas } from "./three-canvas.js";

// Diamante lapidado girando, em WebGL (three.js).
// GUARDADO: saiu do hero, mas está pronto para reusar: <Diamond className="w-full h-full" /> dentro de um bloco com altura.
export default function Diamond({ className }) {
  const ref = useThreeCanvas(setupDiamond);
  return <div ref={ref} className={className} aria-hidden="true" />;
}

// Lapidação brilhante: anéis [raio, altura, deslocamento em meio-passo] da mesa até o fundo do pavilhão.
const SIDES = 16, TABLE_Y = 0.36, CULET_Y = -1.08;
const RINGS = [[0.56, TABLE_Y, 0], [0.8, 0.2, 0.5], [1, 0.03, 0], [1, -0.03, 0], [0.5, -0.5, 0.5]];

function diamondGeometry(THREE) {
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const rings = RINGS.map(([r, y, off]) => Array.from({ length: SIDES }, (_, i) => {
    const a = ((i + off) / SIDES) * Math.PI * 2;
    return V(Math.cos(a) * r, y, Math.sin(a) * r);
  }));
  const tris = [];
  const fan = (c, R) => R.forEach((p, i) => tris.push([c, p, R[(i + 1) % SIDES]]));

  fan(V(0, TABLE_Y, 0), rings[0]);
  for (let k = 0; k < rings.length - 1; k++) {
    const A = rings[k], B = rings[k + 1], d = RINGS[k + 1][2] - RINGS[k][2];
    for (let i = 0; i < SIDES; i++) {
      const j = (i + 1) % SIDES;
      if (d > 0) tris.push([A[i], B[i], A[j]], [B[i], B[j], A[j]]);       // B adiantado meio passo
      else if (d < 0) tris.push([A[i], B[j], A[j]], [B[i], B[j], A[i]]);  // B atrasado meio passo
      else tris.push([A[i], B[i], B[j]], [A[i], B[j], A[j]]);             // alinhados (cinta)
    }
  }
  fan(V(0, CULET_Y, 0), rings.at(-1));

  // Forma convexa em volta da origem: normal de cada faceta aponta para fora.
  const pos = [];
  for (const [a, b, c] of tris) {
    const n = b.clone().sub(a).cross(c.clone().sub(a));
    const m = a.clone().add(b).add(c);
    const [p, q] = n.dot(m) < 0 ? [c, b] : [b, c];
    pos.push(...a.toArray(), ...p.toArray(), ...q.toArray());
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.computeVertexNormals(); // sem índices: normais por faceta
  return geo;
}

function setupDiamond({ THREE, scene, pointer }) {
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 50);
  camera.position.set(0, 0.7, 5.2);
  camera.lookAt(0, -0.32, 0);

  const geo = diamondGeometry(THREE);
  const edgesGeo = new THREE.EdgesGeometry(geo, 1);
  const bodyMat = new THREE.MeshPhysicalMaterial({
    color: 0x6a2bc2, metalness: 0.3, roughness: 0.07, flatShading: true,
    clearcoat: 1, clearcoatRoughness: 0.03, iridescence: 0.35, iridescenceIOR: 1.8,
    envMapIntensity: 1.25,
  });
  const edgeMat = new THREE.LineBasicMaterial({
    color: 0xded6ff, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const gem = new THREE.Group();
  gem.add(new THREE.Mesh(geo, bodyMat), new THREE.LineSegments(edgesGeo, edgeMat));
  gem.rotation.x = 0.22;
  scene.add(gem);

  const key = new THREE.PointLight(0xcbbaff, 40, 20);
  const rim = new THREE.PointLight(0x5a179a, 60, 20);
  const fill = new THREE.PointLight(0xa07bf6, 25, 20);
  rim.position.set(-3, -1.5, -2);
  fill.position.set(-2.5, 2, 3);
  scene.add(key, rim, fill, new THREE.AmbientLight(0x2a0e4a, 0.6));

  return {
    camera,
    resize: aspect => gem.scale.setScalar(Math.min(1, aspect / 0.95)), // telas estreitas: diminui para caber
    frame(dt, t) {
      gem.rotation.y += dt * 0.35;
      gem.rotation.x += (0.22 + pointer.y * 0.25 - gem.rotation.x) * 0.05; // mouse inclina de leve
      gem.rotation.z += (-pointer.x * 0.15 - gem.rotation.z) * 0.05;
      gem.position.y = Math.sin(t * 0.9) * 0.06;
      key.position.set(Math.cos(t * 0.5) * 4, 3, Math.sin(t * 0.5) * 4 + 2); // brilho que passeia nas facetas
    },
    dispose: () => [geo, edgesGeo, bodyMat, edgeMat].forEach(x => x.dispose()),
  };
}
