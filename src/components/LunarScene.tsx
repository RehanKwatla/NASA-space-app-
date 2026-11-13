import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber';
import { Html, Line, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { useMissionStore } from '../store/missionStore';
import type { LandingSite, Vector3Tuple } from '../science';
import { calculateConditions } from '../science';
import { LANDING_SITES } from '../data/sites';

type CameraCommand = { mode: 'focus' | 'reset' | 'point'; nonce: number; point?: Vector3Tuple } | null;
interface LunarSceneProps { cameraCommand: CameraCommand; onSelectSite: (id: string) => void; onFocusPoint: (point: Vector3Tuple) => void }

const MOON_RADIUS = 1.34;
const KILOMETERS_PER_SCENE_UNIT = 1737.4 / MOON_RADIUS;
const EARTH_RADIUS = 6371 / KILOMETERS_PER_SCENE_UNIT;
const EARTH_DISTANCE = 384400 / KILOMETERS_PER_SCENE_UNIT;
const toVector = (v: Vector3Tuple) => new THREE.Vector3(v.x, v.y, v.z);
const positionOnMoon = (site: LandingSite, radius = MOON_RADIUS) => {
  const lat = THREE.MathUtils.degToRad(site.lat), lon = THREE.MathUtils.degToRad(site.lon);
  return new THREE.Vector3(radius * Math.cos(lat) * Math.cos(lon), radius * Math.sin(lat), radius * Math.cos(lat) * Math.sin(lon));
};

function useMoonMaps() {
  const [albedo, elevation, normal] = useLoader(THREE.TextureLoader, [
    '/textures/lunar-albedo-8k.jpg',
    '/textures/lunar-elevation-16ppd.png',
    '/textures/lunar-normal-lola.png',
  ]);
  const gl = useThree(state => state.gl);
  const anisotropy = gl.capabilities.getMaxAnisotropy();
  useEffect(() => {
    const maps = [albedo, elevation, normal];
    albedo.colorSpace = THREE.SRGBColorSpace;
    elevation.colorSpace = THREE.NoColorSpace;
    normal.colorSpace = THREE.NoColorSpace;
    for (const map of maps) {
      map.generateMipmaps = true;
      map.minFilter = THREE.LinearMipmapLinearFilter;
      map.magFilter = THREE.LinearFilter;
      map.anisotropy = anisotropy;
      map.needsUpdate = true;
    }
  }, [albedo, elevation, normal, anisotropy]);
  return { albedo, elevation, normal };
}

function MoonSurface({ reliefOn, illuminationOn, onFocusPoint }: { reliefOn: boolean; illuminationOn: boolean; onFocusPoint: (point: Vector3Tuple) => void }) {
  const { albedo, elevation, normal } = useMoonMaps();
  return (
      <mesh castShadow receiveShadow onDoubleClick={event => {
        event.stopPropagation();
        onFocusPoint({ x: event.point.x, y: event.point.y, z: event.point.z });
      }}>
      <sphereGeometry args={[MOON_RADIUS, 384, 256]} />
        <meshStandardMaterial
          map={albedo}
          normalMap={reliefOn ? normal : null}
          normalScale={new THREE.Vector2(.42, .42)}
          displacementMap={reliefOn ? elevation : null}
          displacementScale={reliefOn ? .01517 : 0}
          displacementBias={reliefOn ? -.00693 : 0}
          roughness={.96}
          metalness={0}
          color={illuminationOn ? '#ffffff' : '#f4f3f0'}
        />
    </mesh>
  );
}

function Earth({ position, missionHours }: { position: THREE.Vector3; missionHours: number }) {
  const [albedo] = useLoader(THREE.TextureLoader, ['/textures/earth-blue-marble-clouds.png']);
  const gl = useThree(state => state.gl);
  const spin = (missionHours / 23.934) * Math.PI * 2;
  useEffect(() => {
    albedo.colorSpace = THREE.SRGBColorSpace;
    albedo.generateMipmaps = true;
    albedo.minFilter = THREE.LinearMipmapLinearFilter;
    albedo.magFilter = THREE.LinearFilter;
    albedo.anisotropy = gl.capabilities.getMaxAnisotropy();
    albedo.needsUpdate = true;
  }, [albedo, gl]);

  return (
    <group name="earth-celestial-body" position={position} rotation={[THREE.MathUtils.degToRad(23.44), spin, 0]}>
      <mesh castShadow receiveShadow>
        <sphereGeometry args={[EARTH_RADIUS, 96, 64]} />
        <meshStandardMaterial map={albedo} roughness={.94} metalness={0} />
      </mesh>
      <mesh scale={1.012}>
        <sphereGeometry args={[EARTH_RADIUS, 64, 48]} />
        <shaderMaterial
          transparent
          depthWrite={false}
          side={THREE.BackSide}
          vertexShader={`
            varying vec3 vNormal;
            varying vec3 vViewDirection;
            void main() {
              vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
              vNormal = normalize(normalMatrix * normal);
              vViewDirection = normalize(-viewPosition.xyz);
              gl_Position = projectionMatrix * viewPosition;
            }
          `}
          fragmentShader={`
            varying vec3 vNormal;
            varying vec3 vViewDirection;
            void main() {
              float rim = pow(1.0 - max(dot(normalize(vNormal), normalize(vViewDirection)), 0.0), 3.2);
              gl_FragColor = vec4(0.30, 0.49, 0.68, rim * 0.16);
              #include <tonemapping_fragment>
              #include <colorspace_fragment>
            }
          `}
        />
      </mesh>
    </group>
  );
}

function Marker({ site, selected, onSelect, onFocusPoint }: { site: LandingSite; selected: boolean; onSelect: () => void; onFocusPoint: (point: Vector3Tuple) => void }) {
  const dot = useRef<THREE.Mesh>(null);
  const halo = useRef<THREE.Mesh>(null);
  const ringMaterial = useRef<THREE.MeshBasicMaterial>(null);
  const [hovered, setHovered] = useState(false);
  const location = useMemo(() => positionOnMoon(site, MOON_RADIUS + .016), [site]);
  const normal = useMemo(() => location.clone().normalize(), [location]);
  useFrame(({ clock }, delta) => {
    const emphasis = selected ? 1.33 + Math.sin(clock.elapsedTime * 2.5) * .07 : hovered ? 1.42 : 1;
    if (dot.current) dot.current.scale.lerp(new THREE.Vector3(emphasis, emphasis, emphasis), 1 - Math.exp(-10 * delta));
    if (halo.current) halo.current.scale.lerp(new THREE.Vector3(hovered || selected ? 1.5 : .001, hovered || selected ? 1.5 : .001, hovered || selected ? 1.5 : .001), 1 - Math.exp(-7 * delta));
    if (ringMaterial.current) ringMaterial.current.opacity = THREE.MathUtils.damp(ringMaterial.current.opacity, hovered || selected ? .78 : .32, 8, delta);
  });
  return (
    <group position={location.toArray()} quaternion={new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal)} onClick={e => { e.stopPropagation(); onSelect(); }} onDoubleClick={e => { e.stopPropagation(); onSelect(); onFocusPoint({ x: e.point.x, y: e.point.y, z: e.point.z }); }} onPointerOver={e => { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer'; }} onPointerOut={() => { setHovered(false); document.body.style.cursor = ''; }}>
      <mesh ref={halo} scale={.001}><sphereGeometry args={[.045, 18, 14]} /><meshBasicMaterial color="#69e6f3" transparent opacity={.12} depthWrite={false} /></mesh>
      <mesh ref={dot}><sphereGeometry args={[.033, 16, 12]} /><meshBasicMaterial color={selected || hovered ? '#a1f8ff' : '#61cbdc'} /></mesh>
      <mesh><ringGeometry args={[selected ? .053 : .044, selected ? .062 : .05, 32]} /><meshBasicMaterial ref={ringMaterial} color="#65d8e8" transparent opacity={selected ? .76 : .32} side={THREE.DoubleSide} /></mesh>
      {selected && <Line points={[new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, .12)]} color="#69d8e7" lineWidth={1} transparent opacity={.6} />}
      {(selected || hovered) && <Html distanceFactor={8} position={[.08, .09, .02]} center occlude>
        <div className="marker-tooltip-html"><b>{site.name}</b><span>{Math.abs(site.lat).toFixed(2)}° S · {Math.abs(site.lon).toFixed(2)}° {site.lon < 0 ? 'W' : 'E'}</span><small>{site.terrain} · {site.description}</small></div>
      </Html>}
    </group>
  );
}

function Starfield() {
  const tiers = useMemo(() => {
    let seed = 54421;
    const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    const bands = [new Float32Array(2100 * 3), new Float32Array(260 * 3), new Float32Array(42 * 3)];
    for (let i = 0; i < 2402; i++) {
      const band = i < 2100 ? 0 : i < 2360 ? 1 : 2;
      const offset = (i < 2100 ? i : i < 2360 ? i - 2100 : i - 2360) * 3;
      const radius = 760 + random() * 170;
      const theta = random() * Math.PI * 2;
      const phi = Math.acos(2 * random() - 1);
      bands[band][offset] = radius * Math.sin(phi) * Math.cos(theta);
      bands[band][offset + 1] = radius * Math.cos(phi);
      bands[band][offset + 2] = radius * Math.sin(phi) * Math.sin(theta);
    }
    return bands;
  }, []);
  const makeBand = (positions: Float32Array, size: number, opacity: number, color: string) => (
    <points key={size}>
      <bufferGeometry><bufferAttribute attach="attributes-position" args={[positions, 3]} /></bufferGeometry>
      <pointsMaterial color={color} size={size} sizeAttenuation={false} transparent opacity={opacity} depthWrite={false} />
    </points>
  );
  return <group name="deep-space-stars">{makeBand(tiers[0], .8, .25, '#dce4ee')}{makeBand(tiers[1], 1.15, .34, '#edf1f5')}{makeBand(tiers[2], 1.65, .48, '#fff8ec')}</group>;
}

function SceneContents({ cameraCommand, onSelectSite, onFocusPoint, controlsRef }: LunarSceneProps & { controlsRef: ReturnType<typeof useRef<any>> }) {
  const root = useRef<THREE.Group>(null);
  const sunLight = useRef<THREE.DirectionalLight>(null);
  const cameraTween = useRef<{ from: THREE.Vector3; to: THREE.Vector3; fromTarget: THREE.Vector3; toTarget: THREE.Vector3; start: number; duration: number } | null>(null);
  const parallax = useRef({ x: 0, y: 0 });
  const appliedCameraOffset = useRef(new THREE.Vector3());
  const camera = useThree(state => state.camera);
  const selectedId = useMissionStore(state => state.selectedSiteId);
  const startMs = useMissionStore(state => state.startMs), durationDays = useMissionStore(state => state.durationDays), progress = useMissionStore(state => state.progress);
  const terrainOn = useMissionStore(state => state.terrainOn), illuminationOn = useMissionStore(state => state.illuminationOn), earthOn = useMissionStore(state => state.earthOn);
  const selectedSite = LANDING_SITES.find(site => site.id === selectedId) ?? LANDING_SITES[0];
  const conditions = calculateConditions(selectedSite, progress, durationDays, startMs, LANDING_SITES[0]);
  const sunPosition = useMemo(() => toVector(conditions.sunDir).applyEuler(new THREE.Euler(-1, .05, 0)).multiplyScalar(8), [conditions.sunDir]);
  const earthPosition = useMemo(() => toVector(conditions.earthDir).applyEuler(new THREE.Euler(-1, .05, 0)).setLength(EARTH_DISTANCE), [conditions.earthDir]);
  const sitePosition = useMemo(() => positionOnMoon(selectedSite).applyEuler(new THREE.Euler(-1, .05, 0)), [selectedSite]);

  useEffect(() => {
    if (!sunLight.current) return;
    const shadowCamera = sunLight.current.shadow.camera as THREE.OrthographicCamera;
    shadowCamera.left = -1.6;
    shadowCamera.right = 1.6;
    shadowCamera.top = 1.6;
    shadowCamera.bottom = -1.6;
    shadowCamera.near = .1;
    shadowCamera.far = 18;
    shadowCamera.updateProjectionMatrix();
  }, []);

  useEffect(() => {
    if (!cameraCommand) return;
    const focus = cameraCommand.mode === 'focus' || cameraCommand.mode === 'point';
    const target = cameraCommand.mode === 'point' && cameraCommand.point
      ? toVector(cameraCommand.point)
      : focus ? sitePosition.clone() : new THREE.Vector3(0, 0, 0);
    const destination = focus ? target.clone().add(target.clone().normalize().multiplyScalar(2.45)) : new THREE.Vector3(0, .05, 5.4);
    cameraTween.current = { from: camera.position.clone(), to: destination, fromTarget: controlsRef.current?.target.clone() ?? new THREE.Vector3(), toTarget: target, start: performance.now(), duration: 720 };
  }, [cameraCommand?.nonce, camera, sitePosition, controlsRef]);

  useFrame((state, delta) => {
    if (root.current) {
      const targetX = -1 + state.pointer.y * .004;
      const targetY = .05 + state.pointer.x * .004;
      root.current.rotation.x = THREE.MathUtils.damp(root.current.rotation.x, targetX, 2.5, delta);
      root.current.rotation.y = THREE.MathUtils.damp(root.current.rotation.y, targetY, 2.5, delta);
    }
    // Remove last frame's camera-only cursor offset before OrbitControls updates its orbit.
    camera.position.sub(appliedCameraOffset.current);
    const tween = cameraTween.current;
    if (tween) {
      const t = Math.min(1, (performance.now() - tween.start) / tween.duration), eased = t * t * (3 - 2 * t);
      camera.position.lerpVectors(tween.from, tween.to, eased);
      controlsRef.current?.target.lerpVectors(tween.fromTarget, tween.toTarget, eased);
      if (t >= 1) cameraTween.current = null;
    }
    controlsRef.current?.update();
    const wantedX = state.pointer.x * .018, wantedY = state.pointer.y * .012;
    parallax.current.x = THREE.MathUtils.damp(parallax.current.x, wantedX, 2.2, delta);
    parallax.current.y = THREE.MathUtils.damp(parallax.current.y, wantedY, 2.2, delta);
    appliedCameraOffset.current.set(parallax.current.x, parallax.current.y, 0);
    camera.position.add(appliedCameraOffset.current);
    camera.lookAt(controlsRef.current?.target ?? new THREE.Vector3());
  });

  return (
    <>
      <color attach="background" args={['#040609']} />
      <Starfield />
      <ambientLight intensity={illuminationOn ? .065 : .11} color="#aab6c2" />
      <hemisphereLight args={['#a8bbcf', '#111318', .045]} />
      <group name="celestial-frame">
        <directionalLight ref={sunLight} position={sunPosition.toArray()} intensity={2.25} color="#fff6e9" castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-.00012} shadow-normalBias={.001} />
        {earthOn && <Earth position={earthPosition} missionHours={conditions.elapsedMissionHours} />}
      </group>
      <group ref={root} rotation={[-1, .05, 0]}>
        <MoonSurface reliefOn={terrainOn} illuminationOn={illuminationOn} onFocusPoint={onFocusPoint} />
        {LANDING_SITES.map(site => <Marker key={site.id} site={site} selected={site.id === selectedId} onSelect={() => onSelectSite(site.id)} onFocusPoint={onFocusPoint} />)}
      </group>
      <OrbitControls ref={controlsRef} makeDefault enableDamping dampingFactor={.075} enablePan={false} enableRotate enableZoom minPolarAngle={.035} maxPolarAngle={Math.PI - .035} minDistance={1.72} maxDistance={7.2} rotateSpeed={.52} zoomSpeed={.62} onStart={() => { cameraTween.current = null; }} />
    </>
  );
}

export function LunarScene({ cameraCommand, onSelectSite, onFocusPoint }: LunarSceneProps) {
  const controlsRef = useRef<any>(null);
  return (
    <Canvas className="scene-canvas" dpr={[1, 1.5]} camera={{ position: [0, .05, 5.4], fov: 36, near: .1, far: 1200 }} gl={{ antialias: true, powerPreference: 'high-performance', toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05, outputColorSpace: THREE.SRGBColorSpace }} shadows>
      <Suspense fallback={null}>
        <SceneContents cameraCommand={cameraCommand} onSelectSite={onSelectSite} onFocusPoint={onFocusPoint} controlsRef={controlsRef} />
      </Suspense>
    </Canvas>
  );
}
