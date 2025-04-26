'use client'

import { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import ImageCropper from './imageCropper';
import SpinningBoxWithTextures from './spinningBox';

import img from './sample.webp'

const TEST = false

export default function Home() {
  const [image, setImage] = useState<string | null>(null);
  const [crops, setCrops] = useState<[string, string, string]>(["", "", ""]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => setImage(reader.result as string);
    reader.readAsDataURL(file);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': [] },
    multiple: false,
  });

  // use for debugging
  useEffect(() => {
    if (TEST) setSampleFile()
  }, [])

  // use this only for debugging
  const setSampleFile = async () => {
    const response = await fetch(img.src);
    const blob = await response.blob();
    const file = new File([blob], 'sample.webp', { type: blob.type })

    const f: File[] = []
    f.push(file)

    onDrop(f)
  }

  return (
    <div className="bg-gradient-to-b from-[#1a1a2e] to-[#16213e] min-h-screen text-white font-serif p-8">
      <header className="text-center mb-8">
        <h1 className="text-4xl font-bold text-[#e2c275] tracking-wide">The Mana Ramp</h1>
        <p className="text-gray-400 italic">3D-printed treasures for Magic: The Gathering fans</p>
      </header>

      <section className="max-w-2xl mx-auto space-y-6">
        <h2 className="text-2xl font-semibold text-center">Upload Your Custom Art</h2>

        <div
          {...getRootProps()}
          className={`border-2 border-dashed p-10 text-center rounded-md cursor-pointer transition ${
            isDragActive ? 'border-blue-500 bg-blue-50 text-blue-500' : 'border-gray-300 text-gray-500'
          }`}
        >
          <input {...getInputProps()} />
          {isDragActive ? (
            <p className="font-semibold">Drop the image here...</p>
          ) : (
            <p>Drag & drop an image here, or click to select one</p>
          )}
        </div>

        {crops && <div className="my-6 p-4 rounded-xl bg-gray-800 shadow-lg">
          <h3 className="text-lg mb-2 text-center font-semibold">Preview Your Custom Deck Box</h3>
          <SpinningBoxWithTextures textures={crops} glbPath="/models/edh_box_v1.glb" />
          <button className="mt-4 bg-[#e2c275] text-black px-6 py-2 rounded-md hover:brightness-110 transition block mx-auto">
            Add to Cart
          </button>
        </div> }

        {image && (
          <>
            <h3 className="text-xl font-medium">Crop Your Image</h3>
            <ImageCropper imageSrc={image} setCrops={setCrops} />
          </>
        )}
      </section>
    </div>
  );
}
