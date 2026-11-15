'use client';

import React, { Suspense, useEffect, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { decodeBinaryStl, type Triangle } from '../../../packages/print-core/src/printGeometry';
import { buildLidTextMesh, lidLocalToGlb, lidSlideOffset, splitLid } from '../../../packages/print-core/src/lidGeometry';

interface Props {
  textures: [string, string, string];
  glbPath: string;
  boxColor: string;
  logoColor: string;
  textColor: string;
  lidName: string;
  /** 0 is closed, 1 is slid open toward the notch. */
  lidOpen: number;
}

const FACE_TEXTURE_INDEX: Record<string, number> = {
  Face3: 0,
  Face2: 1,
  Face1: 2,
};

function applyOwnedMaterial(mesh: THREE.Mesh, material: THREE.MeshStandardMaterial) {
  const previous = mesh.material;
  material.userData.owned = true;
  mesh.material = material;
  if (previous instanceof THREE.Material && previous.userData?.owned) {
    previous.dispose();
  }
}

function geometryFromTriangles(triangles: readonly Triangle[]): THREE.BufferGeometry {
  const positions = new Float32Array(triangles.length * 9);
  triangles.forEach((triangle, index) => {
    // STL Y becomes scene Z. That swap mirrors the winding, so vertex 1 and 2 trade places.
    const [a, c, b] = triangle.verts;
    [a, b, c].forEach((vert, vertex) => {
      const [x, y, z] = lidLocalToGlb(vert[0], vert[1], vert[2]);
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

function SlidingLid({ open, children }: { open: number; children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  const current = useRef(lidSlideOffset(open));
  useFrame((_, delta) => {
    const target = lidSlideOffset(open);
    current.current += (target - current.current) * (1 - Math.exp(-8 * delta));
    if (ref.current) ref.current.position.z = current.current;
  });
  return <group ref={ref}>{children}</group>;
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
      fetch('/fonts/Oswald-Bold.ttf').then((response) => {
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
        setTextGeometry(mesh.length > 0 ? geometryFromTriangles(mesh) : null);
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

function TexturedBox({ textures, glbPath, boxColor, logoColor, textColor, lidName, lidOpen }: Props) {
  const modelRef = useRef<THREE.Group>(null);
  const { scene } = useGLTF(glbPath);
  const [autoRotate, setAutoRotate] = useState(true);
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
    scene.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;

      const textureIndex = FACE_TEXTURE_INDEX[mesh.name];
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
  }, [scene, maps, boxColor]);

  useFrame((_, delta) => {
    if (autoRotate && modelRef.current) {
      modelRef.current.rotation.y += delta * 0.5;
    }
  });

  return (
    <group ref={modelRef} onPointerDown={() => setAutoRotate(false)} scale={0.7}>
      <primitive object={scene} />
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

export default function SpinningBoxWithTextures({
  textures,
  glbPath,
  boxColor,
  logoColor,
  textColor,
  lidName,
  lidOpen,
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
        <ambientLight intensity={1.15} />
        <directionalLight
          intensity={1.2}
          position={[5, 12, 4]}
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
        />
        <pointLight intensity={0.55} position={[-8, 6, -6]} />
        <pointLight intensity={0.35} position={[0, 14, 0]} />
        <Suspense fallback={null}>
          <TexturedBox
            textures={textures}
            glbPath={glbPath}
            boxColor={boxColor}
            logoColor={logoColor}
            textColor={textColor}
            lidName={lidName}
            lidOpen={lidOpen}
          />
        </Suspense>
        <OrbitControls target={[0, 6, -8]} enablePan={false} minDistance={42} maxDistance={320} />
      </Canvas>
    </div>
  );
}
