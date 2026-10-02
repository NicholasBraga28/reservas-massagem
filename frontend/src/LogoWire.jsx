import { useThreeCanvas } from "./three-canvas.js";

// Logo da Pausa em 3D: diamante em traço com linhas internas cruzadas, em duas camadas (frente e verso) com profundidade.
// As linhas internas deslizam pelo contorno e se recombinam. Uso decorativo, atrás do texto do hero.
export default function LogoWire({ className }) {
  const ref = useThreeCanvas(setupLogo);
  return <div ref={ref} className={className} aria-hidden="true" />;
}

// Contorno do logo em px (arte de 200×200): canto sup. esq., canto sup. dir., ombro dir., ponta, ombro esq.
const OUTLINE = [[68, 52], [132, 52], [156, 77], [100, 146], [44, 77]];
// Linhas internas: pares de posições no perímetro (0–1, sentido horário a partir do canto sup. esq.).
const CHORDS = [[0.055, 0.48], [0.15, 0.72], [0.889, 0.4], [0.95, 0.58], [0.26, 0.8], [0.1, 0.84]];
const WIDTH = 2.24;        // largura do logo em unidades da cena
const TOP = 0.94;          // altura do topo acima do centro
const DEPTH = 0.07;        // meia espessura (frente ↔ verso)
// Espessura do traço como fração da altura da tela (não cresce com o tamanho do logo).
const R_OUT = 0.0034, R_IN = 0.0021;
const SWAY = 0.045;        // quanto as linhas internas deslizam no perímetro
const REVEAL_S = 2.6;      // duração do desenho de entrada
const TOP_AT = 0.42;       // topo do logo a 42% da altura da tela

const clamp01 = x => Math.min(1, Math.max(0, x));

function setupLogo(ctx) {
  const { THREE, scene, pointer, reduce } = ctx;
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  camera.position.set(0, 0, 10);
  const viewH = 2 * 10 * Math.tan(THREE.MathUtils.degToRad(15));

  // Perímetro 2D → ponto em t (0–1).
  const pts = OUTLINE.map(([x, y]) => new THREE.Vector2((x - 100) / 50, (99 - y) / 50));
  const lens = pts.map((p, i) => p.distanceTo(pts[(i + 1) % pts.length]));
  const total = lens.reduce((a, b) => a + b);
  const tmp2 = new THREE.Vector2();
  const along = t => {
    let d = (((t % 1) + 1) % 1) * total;
    for (let i = 0; i < pts.length; i++) {
      if (d <= lens[i]) return tmp2.lerpVectors(pts[i], pts[(i + 1) % pts.length], d / lens[i]);
      d -= lens[i];
    }
    return tmp2.copy(pts[0]);
  };

  // Barras = cilindro unitário compartilhado, posicionado/escalado a cada quadro.
  const barGeo = new THREE.CylinderGeometry(1, 1, 1, 12, 1);
  const jointGeo = new THREE.SphereGeometry(1, 16, 10);
  const frontMat = new THREE.MeshStandardMaterial({ emissiveIntensity: 0.7, metalness: 0.2, roughness: 0.4 });
  const backMat = new THREE.MeshStandardMaterial({ emissiveIntensity: 0.6, metalness: 0.2, roughness: 0.45 });

  // Cores vêm dos tokens do CSS (--logo-*), então seguem o tema claro/escuro/alto contraste.
  const css = (name, fallback) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
  const applyTheme = () => {
    frontMat.color.set(css("--logo-front", "#cbbaff"));
    frontMat.emissive.set(css("--logo-front-glow", "#a07bf6"));
    backMat.color.set(css("--logo-back", "#7a46d8"));
    backMat.emissive.set(css("--logo-back-glow", "#5a179a"));
  };
  const onTheme = () => { applyTheme(); ctx.redraw(); };
  applyTheme();
  const mo = new MutationObserver(onTheme);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  const mqs = ["(prefers-color-scheme: dark)", "(prefers-contrast: more)"].map(q => window.matchMedia(q));
  mqs.forEach(m => m.addEventListener("change", onTheme));
  const logo = new THREE.Group();
  scene.add(logo);
  const bar = mat => { const m = new THREE.Mesh(barGeo, mat); logo.add(m); return m; };
  const joint = mat => { const m = new THREE.Mesh(jointGeo, mat); logo.add(m); return m; };

  const UP = new THREE.Vector3(0, 1, 0), dir = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3();
  // Barra de p a q, desenhada até a fração k (animação de entrada).
  function place(m, p, q, r, k) {
    dir.subVectors(q, p).multiplyScalar(k);
    const len = dir.length();
    m.visible = len > 1e-4;
    if (!m.visible) return;
    m.position.copy(p).addScaledVector(dir, 0.5);
    m.quaternion.setFromUnitVectors(UP, dir.divideScalar(len));
    m.scale.set(r, len, r);
  }

  const layers = [
    { z: DEPTH, mat: frontMat, phase: 0 },
    { z: -DEPTH, mat: backMat, phase: 2.1 },
  ].map(L => ({
    ...L,
    edges: pts.map(() => bar(L.mat)),
    joints: pts.map(() => joint(L.mat)),
    chords: CHORDS.map(() => bar(L.mat)),
  }));
  const links = pts.map(() => bar(backMat));

  scene.add(new THREE.AmbientLight(0x2a0e4a, 0.8));
  const key = new THREE.PointLight(0xcbbaff, 60, 30);
  scene.add(key);

  let ry = 0, rx = 0, rOut = R_OUT, rIn = R_IN;
  return {
    camera,
    resize(aspect) {
      // Preenche a metade de baixo: ~125% da largura da tela, topo do logo em TOP_AT da altura.
      const s = (1.25 * viewH * aspect) / WIDTH;
      logo.scale.setScalar(s);
      logo.position.y = viewH * (0.5 - TOP_AT) - TOP * s;
      rOut = (R_OUT * viewH) / s;
      rIn = (R_IN * viewH) / s;
    },
    frame(dt, t) {
      const P = reduce ? 1 : 1 - (1 - clamp01(t / REVEAL_S)) ** 3; // progresso da entrada, com desaceleração

      for (const L of layers) {
        pts.forEach((p, i) => {
          const k = clamp01((P - i * 0.06) / 0.55);
          a.set(p.x, p.y, L.z);
          const q = pts[(i + 1) % pts.length];
          place(L.edges[i], a, b.set(q.x, q.y, L.z), rOut, k);
          L.joints[i].visible = k > 0;
          L.joints[i].position.copy(a);
          L.joints[i].scale.setScalar(rOut * clamp01(k * 3));
        });
        CHORDS.forEach(([ta, tb], j) => {
          const k = clamp01((P - 0.35 - j * 0.05) / 0.45);
          const wa = reduce ? 0 : SWAY * Math.sin(t * 0.35 + j * 1.7 + L.phase);
          const wb = reduce ? 0 : SWAY * Math.sin(t * 0.27 + j * 2.3 + 1 + L.phase);
          const pa = along(ta + wa); a.set(pa.x, pa.y, L.z);
          const pb = along(tb + wb); b.set(pb.x, pb.y, L.z);
          place(L.chords[j], a, b, rIn, k);
        });
      }
      const kl = clamp01((P - 0.3) / 0.4);
      pts.forEach((p, i) => place(links[i], a.set(p.x, p.y, DEPTH), b.set(p.x, p.y, -DEPTH), rIn, kl));

      // Gira de um lado para o outro (nunca fica de perfil, então a área continua preenchida) + mouse.
      ry += ((reduce ? 0 : Math.sin(t * 0.16) * 0.55) + pointer.x * 0.15 - ry) * 0.05;
      rx += (-0.12 + pointer.y * 0.08 - rx) * 0.05;
      logo.rotation.set(rx, ry, 0);
      key.position.set(Math.cos(t * 0.4) * 6, 2, 6);
    },
    dispose() {
      mo.disconnect();
      mqs.forEach(m => m.removeEventListener("change", onTheme));
      [barGeo, jointGeo, frontMat, backMat].forEach(x => x.dispose());
    },
  };
}
