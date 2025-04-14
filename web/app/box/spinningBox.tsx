"use client"


import React, { useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, useTexture, useGLTF } from "@react-three/drei";
import * as THREE from "three";

interface Props {
  textures: [string, string, string]; // base64 or URL for 3 images
  glbPath: string; // path to your GLB file
}

function TexturedBox({ textures, glbPath }: Props) {
  const modelRef = useRef<THREE.Group>(null);
  const [texture1, texture2, texture3] = useTexture(textures);
  const { scene, nodes } = useGLTF(glbPath) as any;
  const [autoRotate, setAutoRotate] = useState(true);

  useFrame((_, delta) => {
    if (autoRotate && modelRef.current) {
      modelRef.current.rotation.y += delta * 0.5;
    }
  });

  return (
    <group ref={modelRef} onPointerDown={() => setAutoRotate(false)}>
      {/* Make sure your GLB has named meshes: Face1, Face2, Face3 */}
      <mesh geometry={nodes.Face1.geometry}>
        <meshStandardMaterial map={texture1} />
      </mesh>
      <mesh geometry={nodes.Face2.geometry}>
        <meshStandardMaterial map={texture2} />
      </mesh>
      <mesh geometry={nodes.Face3.geometry}>
        <meshStandardMaterial map={texture3} />
      </mesh>
    </group>
  );
}

export default function SpinningBoxWithTextures({ textures, glbPath }: Props) {
  return (
    <Canvas camera={{ position: [0, 0, 40] }} style={{width: 1040, height: 1040}}>
      <ambientLight intensity={0.7} />
      <directionalLight position={[2, 2, 2]} />
      <TexturedBox textures={textures} glbPath={glbPath} />
      <OrbitControls enableZoom={true} minDistance={30} maxDistance={50} />
    </Canvas>
  );
}