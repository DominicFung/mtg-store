'use client';

import React, { Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { SHELL_FACE_CROP, WRAP_PLATES, type WrapPlate } from '../../../packages/print-core/src/boxWrap';
import { decodeBinaryStl, type Triangle } from '../../../packages/print-core/src/printGeometry';
import { buildLidTextMesh, clampLidOffset, LID_FONT_FILE, LID_SIZE, lidLocalToGlb, lidSlideOffset, splitLid } from '../../../packages/print-core/src/lidGeometry';
import type { ReliefBuffers } from '../lib/reliefClient';

interface Props {
  textures: [string, string, string];
  glbPath: string;
  boxColor: string;
  logoColor: string;
  textColor: string;
  lidName: string;
  /** 0 is closed, 1 is slid open toward the card window. */
  lidOpen: number;
  /** Posed camera for the orientation check. Omitted in the shop. */
  shot?: string | null;
  /** Colour-core surface for the right face, the spine, and the left face. */
  relief?: Array<ReliefBuffers | null>;
}

type PlateFrame = WrapPlate;

const RELIEF_PLATES = WRAP_PLATES;
const FACE_TEXTURE_INDEX: Record<string, number> = SHELL_FACE_CROP;

const SHOTS: Record<string, { position: [number, number, number]; target: [number, number, number]; up?: [number, number, number] }> = {
  // Same camera the shop uses before anyone drags it.
  shop: { position: [36, 118, -62], target: [0, 6, -8] },
  front: { position: [0, 62, 140], target: [0, 2, 12] },
  left: { position: [150, 22, -8], target: [0, 6, -6] },
  right: { position: [-150, 22, -8], target: [0, 6, -6] },
  back: { position: [0, 36, -140], target: [0, 6, -8] },
  top: { position: [0, 170, 0], target: [0, 0, 4], up: [0, 0, -1] },
  open: { position: [42, 78, 160], target: [0, 6, 16] },
  // Grazing views so the face relief reads as height, not a flat picture.
  'graze-right': { position: [-58, 8, 72], target: [-30, -6, -8] },
  'graze-back': { position: [64, 10, -58], target: [0, -6, -40] },
  'graze-left': { position: [58, 8, 72], target: [28, -6, -8] },
  box: { position: [78, 46, 96], target: [0, 2, -6] },
  // Corners where the stitched panels meet: right into the spine, then the spine into the left.
  'seam-right': { position: [120, 36, -130], target: [8, 0, -36] },
  'seam-left': { position: [-120, 36, -130], target: [-8, 0, -36] },
  closed: { position: [46, 128, 148], target: [2, 2, 6] },
};

function applyOwnedMaterial(mesh: THREE.Mesh, material: THREE.MeshStandardMaterial) {
  const previous = mesh.material;
  material.userData.owned = true;
  mesh.material = material;
  if (previous instanceof THREE.Material && previous.userData?.owned) {
    previous.dispose();
  }
}

function geometryFromTriangles(triangles: readonly Triangle[], mirrorX = false): THREE.BufferGeometry {
  const positions = new Float32Array(triangles.length * 9);
  triangles.forEach((triangle, index) => {
    // Scene Z is STL Y, which mirrors the shell. The name mesh is already turned
    // 180° with the lid, so one more X flip makes it read the same way in the preview.
    const verts = mirrorX
      ? triangle.verts
      : [triangle.verts[0], triangle.verts[2], triangle.verts[1]] as const;
    verts.forEach((vert, vertex) => {
      const localX = mirrorX ? LID_SIZE.width - vert[0] : vert[0];
      const [x, y, z] = lidLocalToGlb(localX, vert[1], vert[2]);
      const offset = index * 9 + vertex * 3;
      positions[offset] = x;
      positions[offset + 1] = y;
      positions[offset + 2] = z;
    });
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

const SEATED_LID_POSITION: [number, number, number] = [0, 0, lidSlideOffset(0)];

function SlidingLid({ open, children }: { open: number; children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  const current = useRef(lidSlideOffset(open));
  useLayoutEffect(() => {
    current.current = clampLidOffset(current.current);
    if (ref.current) ref.current.position.z = clampLidOffset(ref.current.position.z);
  }, []);
  useFrame((_, delta) => {
    const target = lidSlideOffset(open);
    const step = 1 - Math.exp(-8 * Math.max(0, delta));
    const blended = current.current + (target - current.current) * Math.min(1, step);
    current.current = clampLidOffset(blended);
    if (ref.current) ref.current.position.z = current.current;
  });
  return <group ref={ref} position={SEATED_LID_POSITION}>{children}</group>;
}

function LidMeshes({
  boxColor,
  logoColor,
  textColor,
  lidName,
  lidOpen,
}: Pick<Props, 'boxColor' | 'logoColor' | 'textColor' | 'lidName' | 'lidOpen'>) {
  const [parts, setParts] = useState<{ base: THREE.BufferGeometry; spark: THREE.BufferGeometry } | null>(null);
  const [textGeometry, setTextGeometry] = useState<THREE.BufferGeometry | null>(null);
  const [fontBuffer, setFontBuffer] = useState<ArrayBuffer | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch('/models/Lid.stl').then((response) => {
        if (!response.ok) throw new Error('lid');
        return response.arrayBuffer();
      }),
      fetch(`/fonts/${LID_FONT_FILE}`).then((response) => {
        if (!response.ok) throw new Error('font');
        return response.arrayBuffer();
      }),
    ]).then(([stl, font]) => {
      if (cancelled) return;
      const split = splitLid(decodeBinaryStl(new Uint8Array(stl)), false);
      setParts({
        base: geometryFromTriangles(split.base),
        spark: geometryFromTriangles(split.spark),
      });
      setFontBuffer(font);
    }).catch(() => {
      if (!cancelled) setFailed(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => () => {
    parts?.base.dispose();
    parts?.spark.dispose();
  }, [parts]);

  useEffect(() => {
    if (!fontBuffer) return undefined;
    const cleaned = lidName.trim();
    if (!cleaned) {
      setTextGeometry((current) => {
        current?.dispose();
        return null;
      });
      return undefined;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      try {
        const mesh = buildLidTextMesh(fontBuffer, cleaned);
        if (cancelled) return;
        setTextGeometry(mesh.length > 0 ? geometryFromTriangles(mesh, true) : null);
      } catch {
        if (!cancelled) setFailed(true);
      }
    }, 30);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [fontBuffer, lidName]);

  useEffect(() => () => {
    textGeometry?.dispose();
  }, [textGeometry]);

  if (failed || !parts) return null;
  return (
    <SlidingLid open={lidOpen}>
      <mesh geometry={parts.base}>
        <meshStandardMaterial color={boxColor} roughness={0.62} metalness={0.04} />
      </mesh>
      <mesh geometry={parts.spark}>
        <meshStandardMaterial color={logoColor} roughness={0.45} metalness={0.08} />
      </mesh>
      {textGeometry && (
        <mesh geometry={textGeometry}>
          <meshStandardMaterial color={textColor} roughness={0.5} metalness={0.06} />
        </mesh>
      )}
    </SlidingLid>
  );
}

function ReliefPlate({ buffers, texture, plate }: { buffers: ReliefBuffers; texture: THREE.Texture | null; plate: PlateFrame }) {
  const geometry = React.useMemo(() => {
    const next = new THREE.BufferGeometry();
    // Copy first. The placement mutates the attribute, and a remount would
    // otherwise transform the same samples a second time.
    next.setAttribute('position', new THREE.BufferAttribute(buffers.positions.slice(), 3));
    next.setAttribute('uv', new THREE.BufferAttribute(buffers.uvs.slice(), 2));
    next.setIndex(new THREE.BufferAttribute(buffers.index.slice(), 1));
    const width = buffers.widthMm || plate.widthMm;
    const height = buffers.heightMm || plate.heightMm;
    next.translate(0, 0, 0.6);
    next.scale(plate.widthMm / width, plate.heightMm / height, 1);
    next.applyMatrix4(new THREE.Matrix4().makeBasis(
      new THREE.Vector3(...plate.axisX),
      new THREE.Vector3(...plate.axisY),
      new THREE.Vector3(...plate.axisZ),
    ));
    next.translate(plate.center[0], plate.center[1], plate.center[2]);
    next.computeVertexNormals();
    return next;
  }, [buffers, plate]);

  React.useEffect(() => () => {
    geometry.dispose();
  }, [geometry]);

  return (
    <mesh geometry={geometry}>
      {texture ? (
        <meshStandardMaterial map={texture} color="#ffffff" roughness={0.78} metalness={0} side={THREE.DoubleSide} />
      ) : (
        <meshStandardMaterial color="#c8c8c8" roughness={0.58} metalness={0.03} side={THREE.DoubleSide} />
      )}
    </mesh>
  );
}

function TexturedBox({ textures, glbPath, boxColor, logoColor, textColor, lidName, lidOpen, shot, relief }: Props) {
  const modelRef = useRef<THREE.Group>(null);
  const { scene } = useGLTF(glbPath);
  const [autoRotate, setAutoRotate] = useState(!shot);
  const [maps, setMaps] = useState<(THREE.Texture | null)[]>([null, null, null]);
  const requestId = useRef(0);
  const activeMaps = useRef<(THREE.Texture | null)[]>([]);
  const appliedMaps = useRef<(THREE.Texture | null)[]>([]);
  const seenOpen = useRef(lidOpen);

  useEffect(() => {
    if (seenOpen.current !== lidOpen) {
      seenOpen.current = lidOpen;
      setAutoRotate(false);
    }
  }, [lidOpen]);

  useEffect(() => {
    const id = requestId.current + 1;
    requestId.current = id;
    let cancelled = false;
    const loader = new THREE.TextureLoader();

    Promise.all(textures.map((url) => {
      if (!url) return Promise.resolve(null);
      return loader.loadAsync(url).then((texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.wrapS = THREE.ClampToEdgeWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
        texture.needsUpdate = true;
        return texture;
      });
    })).then((loaded) => {
      if (cancelled || requestId.current !== id) {
        loaded.forEach((texture) => texture?.dispose());
        return;
      }
      activeMaps.current = loaded;
      setMaps(loaded);
    }).catch(() => {
      if (!cancelled && requestId.current === id) setMaps([null, null, null]);
    });

    return () => {
      cancelled = true;
    };
  }, [textures]);

  useEffect(() => () => {
    activeMaps.current.forEach((texture) => texture?.dispose());
  }, []);

  useEffect(() => {
    if (shot) setAutoRotate(false);
  }, [shot]);

  useEffect(() => {
    scene.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;

      const textureIndex = FACE_TEXTURE_INDEX[mesh.name];
      if (textureIndex !== undefined && relief?.[textureIndex]) {
        mesh.visible = false;
        return;
      }
      mesh.visible = true;
      if (textureIndex === undefined) {
        if (mesh.name === 'edh_box') {
          applyOwnedMaterial(mesh, new THREE.MeshStandardMaterial({
            color: boxColor,
            metalness: 0.04,
            roughness: 0.62,
          }));
        }
        return;
      }

      const map = maps[textureIndex];
      applyOwnedMaterial(mesh, new THREE.MeshStandardMaterial({
        map: map ?? undefined,
        color: map ? '#ffffff' : '#8a8a8a',
        metalness: 0.04,
        roughness: 0.84,
      }));
    });

    const previous = appliedMaps.current;
    appliedMaps.current = maps;
    previous.forEach((texture) => {
      if (texture && !maps.includes(texture)) texture.dispose();
    });
  }, [scene, maps, boxColor, relief]);

  useFrame((_, delta) => {
    if (autoRotate && !shot && modelRef.current) {
      modelRef.current.rotation.y += delta * 0.5;
    }
  });

  return (
    <group ref={modelRef} onPointerDown={() => setAutoRotate(false)} scale={0.7}>
      <primitive object={scene} />
      {relief?.map((buffers, index) => (
        buffers ? (
          <ReliefPlate
            key={`relief-${index}-${buffers.positions.byteLength}`}
            buffers={buffers}
            texture={maps[index] ?? null}
            plate={RELIEF_PLATES[index]}
          />
        ) : null
      ))}
      <LidMeshes
        boxColor={boxColor}
        logoColor={logoColor}
        textColor={textColor}
        lidName={lidName}
        lidOpen={lidOpen}
      />
    </group>
  );
}

useGLTF.preload('/models/edh_box_v1.glb');

function ShotCamera({ shot }: { shot: string }) {
  const camera = useThree((state) => state.camera);
  const controls = useThree((state) => state.controls) as { target: THREE.Vector3; update: () => void } | null;
  useLayoutEffect(() => {
    const spec = SHOTS[shot];
    if (!spec) return;
    camera.up.set(...(spec.up ?? [0, 1, 0]));
    camera.position.set(...spec.position);
    camera.lookAt(...spec.target);
    camera.updateProjectionMatrix();
    if (controls?.target) {
      controls.target.set(...spec.target);
      controls.update();
    }
  }, [camera, controls, shot]);
  useFrame(() => {
    const spec = SHOTS[shot];
    if (!spec) return;
    camera.up.set(...(spec.up ?? [0, 1, 0]));
    camera.position.set(...spec.position);
    camera.lookAt(...spec.target);
    if (controls?.target) controls.target.set(...spec.target);
  });
  return null;
}

export default function SpinningBoxWithTextures({
  textures,
  glbPath,
  boxColor,
  logoColor,
  textColor,
  lidName,
  lidOpen,
  shot,
  relief,
}: Props) {
  return (
    <div className="relative mx-auto aspect-square w-full min-w-0 max-w-[640px]">
      <Canvas
        className="!absolute inset-0 h-full w-full max-w-full touch-none"
        camera={{ position: [36, 118, -62], fov: 32, far: 5000 }}
        style={{ width: '100%', height: '100%' }}
        dpr={[1, 1.5]}
        gl={{ preserveDrawingBuffer: true }}
      >
        <color attach="background" args={['#1f2937']} />
        <ambientLight intensity={0.62} />
        <hemisphereLight color="#fff8f2" groundColor="#243044" intensity={0.4} />
        <directionalLight intensity={0.85} position={[95, 40, 24]} />
        <directionalLight intensity={0.85} position={[-95, 40, 24]} />
        <directionalLight intensity={0.75} position={[8, 30, -120]} />
        <Suspense fallback={null}>
          <TexturedBox
            textures={textures}
            glbPath={glbPath}
            boxColor={boxColor}
            logoColor={logoColor}
            textColor={textColor}
            lidName={lidName}
            lidOpen={lidOpen}
            shot={shot}
            relief={relief}
          />
        </Suspense>
        {shot && <ShotCamera shot={shot} />}
        <OrbitControls enabled={!shot} target={[0, 6, -8]} enablePan={false} minDistance={42} maxDistance={320} />
      </Canvas>
    </div>
  );
}
