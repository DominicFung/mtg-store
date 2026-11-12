'use client';

import React, { Suspense, useEffect, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, useGLTF } from '@react-three/drei';
import * as THREE from 'three';

interface Props {
  textures: [string, string, string];
  glbPath: string;
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

function TexturedBox({ textures, glbPath }: Props) {
  const modelRef = useRef<THREE.Group>(null);
  const { scene } = useGLTF(glbPath);
  const [autoRotate, setAutoRotate] = useState(true);
  const [maps, setMaps] = useState<(THREE.Texture | null)[]>([null, null, null]);
  const requestId = useRef(0);
  const activeMaps = useRef<(THREE.Texture | null)[]>([]);
  const appliedMaps = useRef<(THREE.Texture | null)[]>([]);

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
            color: '#8d8d8d',
            metalness: 0.02,
            roughness: 0.9,
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
  }, [scene, maps]);

  useFrame((_, delta) => {
    if (autoRotate && modelRef.current) {
      modelRef.current.rotation.y += delta * 0.5;
    }
  });

  return (
    <group ref={modelRef} onPointerDown={() => setAutoRotate(false)} scale={0.7}>
      <primitive object={scene} />
    </group>
  );
}

useGLTF.preload('/models/edh_box_v1.glb');

export default function SpinningBoxWithTextures({ textures, glbPath }: Props) {
  return (
    <div className="mx-auto aspect-square w-full max-w-[640px]">
      <Canvas
        camera={{ position: [0, 40, 40], far: 10000 }}
        style={{ width: '100%', height: '100%' }}
        gl={{ preserveDrawingBuffer: true }}
      >
        <color attach="background" args={['#1f2937']} />
        <ambientLight intensity={1} />
        <directionalLight
          intensity={1}
          position={[5, 5, 5]}
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
        />
        <pointLight intensity={0.5} position={[-5, -5, -5]} />
        <pointLight intensity={0.3} position={[0, 10, 0]} />
        <Suspense fallback={null}>
          <TexturedBox textures={textures} glbPath={glbPath} />
        </Suspense>
        <OrbitControls minDistance={100} maxDistance={1000} />
      </Canvas>
    </div>
  );
}
