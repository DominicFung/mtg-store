'use client'

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import ImageCropper from './imageCropper';
import SpinningBoxWithTextures from './spinningBox';

export default function Home() {
  const [image, setImage] = useState<string | null>(null);
  const [crops, setCrops] = useState<[string, string, string] | null>(null);

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

  return (
    <div className="p-4">
      {/* {crops && <div className=''>
        <SpinningBoxWithTextures
          textures={crops} // base64 or hosted image URLs
          glbPath="/models/three-sided-box.glb"
        />
      </div>} */}
      
      <div
        {...getRootProps()}
        className={`border-2 border-dashed p-10 text-center rounded-md cursor-pointer transition ${
          isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
        }`}
      >
        <input {...getInputProps()} />
        {isDragActive ? (
          <p className="text-blue-500 font-semibold">Drop the image here...</p>
        ) : (
          <p className="text-gray-500">Drag & drop an image here, or click to select one</p>
        )}
      </div>

      {image && <ImageCropper imageSrc={image} setCrops={setCrops}/>}
    </div>
  );
}
