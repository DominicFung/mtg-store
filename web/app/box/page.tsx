'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import JSZip from 'jszip';
import ImageCropper from './imageCropper';
import SpinningBoxWithTextures from './spinningBox';
import FilamentStack from './filamentStack';
import { useCart } from '../lib/useCart';
import { useFilaments } from '../lib/filaments';
import {
  defaultLayerSelection,
  Filament,
  FilamentLayerSettings,
  MOCK_FILAMENTS,
} from '../lib/filamentCatalogue';
import { equalBoundaries, NOMINAL_LAYER_MM } from '../lib/hueforge';
import { renderLayeredCrops } from '../lib/renderLayers';
import img from './sample.webp';

const DOWNLOAD = true;
const EMPTY_TEXTURES: [string, string, string] = ['', '', ''];

const startingLayers = defaultLayerSelection(MOCK_FILAMENTS);

function layerRecipe(layers: Filament[], boundaries: number[]) {
  return {
    note: 'hex and td are approximate placeholders until each spool is measured. Order is bottom (printed first) to top.',
    nominalLayerMm: NOMINAL_LAYER_MM,
    layers: layers.map((layer, index) => ({
      index,
      role: index === 0 ? 'backing' : index === layers.length - 1 ? 'highlight' : 'mid',
      id: layer.id,
      name: layer.name,
      hex: layer.hex,
      td: layer.td,
      approximate: layer.approximate,
      inStock: layer.inStock,
      brand: layer.brand,
      material: layer.material,
      finish: layer.finish,
      luminanceMin: index === 0 ? 0 : boundaries[index - 1],
      luminanceMax: index === layers.length - 1 ? 1 : boundaries[index],
    })),
  };
}

export default function Home() {
  const [image, setImage] = useState<string | null>(null);
  const [crops, setCrops] = useState<[string, string, string]>(['', '', '']);
  const [layered, setLayered] = useState<[string, string, string]>(['', '', '']);
  const [zip, setZip] = useState<JSZip | null>(null);
  const [layers, setLayers] = useState<Filament[]>(startingLayers);
  const [boundaries, setBoundaries] = useState<number[]>(() => equalBoundaries(startingLayers.length));
  const { filaments, source } = useFilaments();
  const { addItem } = useCart();
  const layersRef = useRef(layers);
  layersRef.current = layers;

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

  const setSampleFile = async () => {
    const response = await fetch(img.src);
    const blob = await response.blob();
    const file = new File([blob], 'sample.webp', { type: blob.type });
    onDrop([file]);
  };

  useEffect(() => {
    const byId = new Map(filaments.map((filament) => [filament.id, filament]));
    const current = layersRef.current;
    if (current.length >= 2 && current.every((layer) => byId.has(layer.id))) {
      setLayers(current.map((layer) => byId.get(layer.id)!));
      return;
    }
    const next = defaultLayerSelection(filaments);
    setLayers(next);
    setBoundaries(equalBoundaries(next.length));
  }, [filaments]);

  useEffect(() => {
    if (!crops[0] || layers.length === 0) {
      setLayered(['', '', '']);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      renderLayeredCrops(crops, layers, boundaries)
        .then((urls) => {
          if (!cancelled) setLayered(urls);
        })
        .catch(() => {
          if (!cancelled) setLayered(crops);
        });
    }, 40);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [crops, layers, boundaries]);

  const downloadAsZip = async (archive: JSZip) => {
    const content = await archive.generateAsync({ type: 'blob' });
    const zipUrl = URL.createObjectURL(content);
    const link = document.createElement('a');
    link.href = zipUrl;
    link.download = 'deck-box-layers.zip';
    link.click();
    URL.revokeObjectURL(zipUrl);
  };

  const settings: FilamentLayerSettings = { layers, boundaries };
  const previewTextures: [string, string, string] = layered[0] ? layered : EMPTY_TEXTURES;
  const canAdd = Boolean(layered[0]);

  const addToCart = async () => {
    if (zip) {
      layered.forEach((url, index) => {
        if (!url.startsWith('data:image/png;base64,')) return;
        zip.file(`layered-${index + 1}.png`, url.replace(/^data:image\/png;base64,/, ''), { base64: true });
      });
      zip.file('filament-layers.json', JSON.stringify(layerRecipe(layers, boundaries), null, 2));
    }

    addItem({
      id: 'custom-deck-box',
      name: 'Custom Deck Box',
      quantity: 1,
      images: layered[0] ? [...layered] : [...crops],
      filamentLayers: settings,
    });

    if (DOWNLOAD && zip) await downloadAsZip(zip);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#1a1a2e] to-[#16213e] p-8 font-serif text-white">
      <header className="mb-8 text-center">
        <h1 className="text-4xl font-bold tracking-wide text-[#e2c275]">The Mana Ramp</h1>
        <p className="italic text-gray-400">3D-printed treasures for Magic: The Gathering fans</p>
      </header>

      <section className="mx-auto max-w-6xl space-y-6">
        <h2 className="text-center text-2xl font-semibold">Upload Your Custom Art</h2>
        <p className="text-center text-sm text-gray-300">
          Position the three faces, then stack the filaments the box will be printed with.
        </p>

        <div
          {...getRootProps()}
          className={`mx-auto max-w-2xl cursor-pointer rounded-md border-2 border-dashed p-10 text-center transition ${
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

        <button
          type="button"
          onClick={() => { void setSampleFile(); }}
          className="mx-auto block rounded-md border border-[#e2c275]/40 px-4 py-2 text-sm text-[#e2c275] hover:bg-white/5"
        >
          Try sample artwork
        </button>

        <div className="my-6 rounded-xl bg-gray-800 p-4 shadow-lg">
          <h3 className="mb-4 text-center text-lg font-semibold">Preview Your Custom Deck Box</h3>
          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,640px)_minmax(0,1fr)]">
            <div>
              <SpinningBoxWithTextures textures={previewTextures} glbPath="/models/edh_box_v1.glb" />
              {crops[0] && !layered[0] && (
                <p className="mt-2 text-center text-xs text-gray-400">Rendering filament layers…</p>
              )}
              {layered[0] && (
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {layered.map((src, index) => (
                    <img
                      key={index}
                      src={src}
                      alt={`Filament preview of face ${index + 1}`}
                      className="w-full rounded bg-black/40"
                    />
                  ))}
                </div>
              )}
            </div>
            <FilamentStack
              filaments={filaments}
              source={source}
              layers={layers}
              boundaries={boundaries}
              onChange={(nextLayers, nextBoundaries) => {
                setLayers(nextLayers);
                setBoundaries(nextBoundaries);
              }}
            />
          </div>
          <button
            type="button"
            disabled={!canAdd}
            onClick={() => { void addToCart(); }}
            className="mx-auto mt-4 block rounded-md bg-[#e2c275] px-6 py-2 text-black transition hover:brightness-110 disabled:bg-gray-300 disabled:text-gray-500 disabled:hover:brightness-100"
          >
            Add to Cart
          </button>
        </div>

        {image && (
          <>
            <h3 className="text-xl font-medium">Crop Your Image</h3>
            <ImageCropper imageSrc={image} setCrops={setCrops} setZip={setZip} />
          </>
        )}
      </section>
    </div>
  );
}
