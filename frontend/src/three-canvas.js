import { useEffect, useRef } from "react";

// Monta uma cena three.js dentro de um <div>: carrega o three sob demanda e cuida de tamanho, loop,
// pausa fora da tela, "reduzir movimento" e limpeza.
// `setup({ THREE, scene, pointer, reduce, redraw })` cria a cena e devolve { camera, frame(dt, t), resize(aspect), dispose() }.
// Passe uma função estável (definida fora do componente).
export function useThreeCanvas(setup) {
  const ref = useRef(null);
  useEffect(() => {
    let stop = () => {}, cancelled = false;
    Promise.all([import("three"), import("three/addons/environments/RoomEnvironment.js")])
      .then(([THREE, { RoomEnvironment }]) => { if (!cancelled) stop = run(THREE, RoomEnvironment, ref.current, setup); });
    return () => { cancelled = true; stop(); };
  }, [setup]);
  return ref;
}

function run(THREE, RoomEnvironment, host, setup) {
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); }
  catch { return () => {}; } // sem WebGL: o fundo em CSS continua lá

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  Object.assign(renderer.domElement.style, { width: "100%", height: "100%", display: "block" });
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = env;

  const pointer = { x: 0, y: 0 };
  const onMove = e => { pointer.x = e.clientX / window.innerWidth - 0.5; pointer.y = e.clientY / window.innerHeight - 0.5; };
  window.addEventListener("pointermove", onMove);

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const ctx = { THREE, scene, pointer, reduce, redraw: () => {} };
  const s = setup(ctx);

  let elapsed = 0, raf = 0, visible = true;
  const clock = new THREE.Clock();
  const draw = dt => { elapsed += dt; s.frame(dt, elapsed); renderer.render(scene, s.camera); };
  ctx.redraw = () => draw(0); // p.ex. tema mudou com a animação parada
  const loop = () => { raf = visible ? requestAnimationFrame(loop) : 0; draw(Math.min(clock.getDelta(), 0.05)); };

  const resize = () => {
    const w = host.clientWidth, h = host.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    s.camera.aspect = w / h;
    s.resize(w / h);
    s.camera.updateProjectionMatrix();
    draw(0);
  };
  const ro = new ResizeObserver(resize);
  ro.observe(host);
  // Fora da tela (rolou para a agenda): para de desenhar.
  const io = new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible && !raf && !reduce) { clock.getDelta(); loop(); }
  });
  io.observe(host);
  resize();
  if (!reduce) loop();

  return () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
    io.disconnect();
    window.removeEventListener("pointermove", onMove);
    s.dispose();
    [env, pmrem, renderer].forEach(x => x.dispose());
    renderer.domElement.remove();
  };
}
