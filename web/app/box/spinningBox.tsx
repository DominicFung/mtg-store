"use client"


import React, { useEffect, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, useTexture, useGLTF, MappedTextureType } from "@react-three/drei";
import * as THREE from "three";

interface Props {
  textures: [string, string, string]; // base64 or URL for 3 images
  glbPath: string; // path to your GLB file
}

function TexturedBox({ textures, glbPath }: Props) {
  const modelRef = useRef<THREE.Group>(null);
  const { scene } = useGLTF(glbPath) as any;
  const [autoRotate, setAutoRotate] = useState(true);

  // Only load textures if they exist
  const loadedTextures = useTexture(
    (textures || []).filter(Boolean)
  ) as THREE.Texture[];

  useEffect(() => {
    scene.traverse((child: any) => {
      if (child.isMesh) {
        if (child.name === 'Face1') {
          if (loadedTextures[2]) {
            loadedTextures[2].needsUpdate = true;
            loadedTextures[2].wrapS = loadedTextures[2].wrapT = THREE.RepeatWrapping;
            child.material = new THREE.MeshStandardMaterial({ map: loadedTextures[2] });
          } else {
            child.material = new THREE.MeshStandardMaterial({ color: 'grey' });
          }
        }
        if (child.name === 'Face2') {
          if (loadedTextures[1]) {
            loadedTextures[1].needsUpdate = true;
            loadedTextures[1].wrapS = loadedTextures[1].wrapT = THREE.RepeatWrapping;
            child.material = new THREE.MeshStandardMaterial({ map: loadedTextures[1] });
          } else {
            child.material = new THREE.MeshStandardMaterial({ color: 'grey' });
          }
        }
        if (child.name === 'Face3') {
          if (loadedTextures[0]) {
            loadedTextures[0].needsUpdate = true;
            loadedTextures[0].wrapS = loadedTextures[0].wrapT = THREE.RepeatWrapping;
            child.material = new THREE.MeshStandardMaterial({ map: loadedTextures[0] });
          } else {
            child.material = new THREE.MeshStandardMaterial({ color: 'grey' });
          }
        }

        if (child.name === 'edh_box') {
          child.material = new THREE.MeshStandardMaterial({
            color: 'grey',
            metalness: 0.01,
            roughness: 0.9,
          });
          child.material.needsUpdate = true;
        }
      }
    });
  }, [scene, loadedTextures]);

  useFrame((_, delta) => {
    if (autoRotate && modelRef.current) {
      modelRef.current.rotation.y += delta * 0.5;
    }
  });

  return (
    <group ref={modelRef} onPointerDown={() => setAutoRotate(false)} scale={0.7}>
      {/* Make sure your GLB has named meshes: Face1, Face2, Face3 */}
      <primitive object={scene} />
    </group>
  );
}

export default function SpinningBoxWithTextures({ textures, glbPath }: Props) {
  return (
    <Canvas camera={{ position: [0, 40, 40], far: 10000 }} style={{width: 640, height: 640}} gl={{ preserveDrawingBuffer: true }}>
      <ambientLight intensity={1} />

      {/* Main directional light */}
      <directionalLight
        intensity={1}
        position={[5, 5, 5]}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />

      {/* Fill lights */}
      <pointLight intensity={0.5} position={[-5, -5, -5]} />
      <pointLight intensity={0.3} position={[0, 10, 0]} />

      <TexturedBox textures={textures} glbPath={glbPath} />
      <OrbitControls minDistance={100} maxDistance={1000} />
    </Canvas>
  );
}