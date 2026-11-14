'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import ImageCropper, { CropBox } from './imageCropper';
import SpinningBoxWithTextures from './spinningBox';
import ColorCore from './colorCore';
import { useCart } from '../lib/useCart';
import { useFilaments } from '../lib/filaments';
import {
  defaultLayerSelection,
  Filament,
  FilamentLayerSettings,
  MOCK_FILAMENTS,
} from '../lib/filamentCatalogue';
import { colorCoreLayerCount, evenStops, formatSwapDepth, shortFilamentName } from '../lib/hueforge';
import { downloadPrintBundle } from '../lib/printBundle';
import { modelSizeForCrop } from '../lib/printGeometry';
import { renderLayeredCrops, toCoreStops } from '../lib/renderLayers';
import { usePrintSettings } from '../lib/usePrintSettings';
import horizonSample from './sample.webp';
import landscapeSample from './mana-landscape.png';

const EMPTY_TEXTURES: [string, string, string] = ['', '', ''];
const STEPS = ['Upload', 'Crop', 'Colours'] as const;

const SAMPLES = [
  { title: 'Horizon sample', src: horizonSample.src, filename: 'horizon-sample.webp' },
  { title: 'Mana landscape', src: landscapeSample.src, filename: 'mana-landscape.png' },
];

const startingLayers = defaultLayerSelection(MOCK_FILAMENTS);
const FACE_NAMES = ['Front', 'Spine', 'Back'] as const;

export default function Home() {
  const [step, setStep] = useState(1);
  const [image, setImage] = useState<string | null>(null);
  const [crops, setCrops] = useState<[string, string, string]>(['', '', '']);
  const [layered, setLayered] = useState<[string, string, string]>(['', '', '']);
  const [cropPx, setCropPx] = useState<Array<{ width: number; height: number } | null>>([null, null, null]);
  const [cropBox, setCropBox] = useState<CropBox | null>(null);
  const [imageToken, setImageToken] = useState(0);
  const [layers, setLayers] = useState<Filament[]>(startingLayers);
  const [stops, setStops] = useState<number[]>(() => evenStops(startingLayers.length, 50));
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const [previewReady, setPreviewReady] = useState(false);
  const { filaments, source } = useFilaments();
  const { settings, source: settingsSource } = usePrintSettings();
  const { addItem } = useCart();
  const layersRef = useRef(layers);
  layersRef.current = layers;

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setImage(reader.result as string);
      setImageToken((current) => current + 1);
      setCrops(['', '', '']);
      setCropPx([null, null, null]);
      setCropBox(null);
    };
    reader.readAsDataURL(file);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': [] },
    multiple: false,
  });

  const useSample = async (src: string) => {
    const response = await fetch(src);
    const blob = await response.blob();
    const reader = new FileReader();
    reader.onload = () => {
      setImage(reader.result as string);
      setImageToken((current) => current + 1);
      setCrops(['', '', '']);
      setCropPx([null, null, null]);
      setCropBox(null);
    };
    reader.readAsDataURL(blob);
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
    setStops(evenStops(next.length, colorCoreLayerCount(settings)));
  }, [filaments, settings]);

  useEffect(() => {
    if (step === 3) setPreviewReady(true);
  }, [step]);

  useEffect(() => {
    if (!crops[0] || layers.length === 0) {
      setLayered(['', '', '']);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      renderLayeredCrops(crops, layers, stops, settings)
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
  }, [crops, layers, stops, settings]);

  useEffect(() => {
    if (!crops[0]) {
      setCropPx([null, null, null]);
      return;
    }
    let cancelled = false;
    Promise.all(crops.map(async (src) => {
      if (!src) return null;
      const image = new Image();
      image.src = src;
      await image.decode();
      return { width: image.naturalWidth, height: image.naturalHeight };
    })).then((sizes) => {
      if (!cancelled) setCropPx(sizes);
    }).catch(() => {
      if (!cancelled) setCropPx([null, null, null]);
    });
    return () => {
      cancelled = true;
    };
  }, [crops]);

  const layerCount = colorCoreLayerCount(settings);
  const coreStops = useMemo(() => toCoreStops(layers, stops), [layers, stops]);
  const faceSizes = cropPx.map((size) => (
    size ? modelSizeForCrop(size.width, size.height, settings.height) : null
  ));
  const previewTextures: [string, string, string] = layered[0] ? layered : (crops[0] ? crops : EMPTY_TEXTURES);

  const unlocked = crops[0] ? 3 : image ? 2 : 1;

  const download = async () => {
    setExporting(true);
    setExportError('');
    try {
      const layeredNow = layered[0] ? layered : await renderLayeredCrops(crops, layers, stops, settings);
      await downloadPrintBundle({
        crops,
        layered: layeredNow,
        layers,
        stops,
        settings,
        settingsSource,
      });
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'Could not build the print files');
    } finally {
      setExporting(false);
    }
  };

  const addToCart = () => {
    const settingsForCart: FilamentLayerSettings = { layers, stops };
    addItem({
      id: 'custom-deck-box',
      name: 'Custom Deck Box',
      quantity: 1,
      images: layered[0] ? [...layered] : [...crops],
      filamentLayers: settingsForCart,
    });
  };

  return (
    <div className="min-h-screen overflow-x-clip bg-gradient-to-b from-[#1a1a2e] to-[#16213e] font-serif text-white">
      <div className="mx-auto w-full max-w-6xl px-4 py-4 pb-28 sm:px-8 sm:py-8">
        <header className="mb-4 text-center sm:mb-6">
          <h1 className="text-2xl font-bold tracking-wide text-[#e2c275] sm:text-4xl">Custom deck box</h1>
          <p className="mt-1 text-sm text-gray-300">Upload art, crop the three faces, then set the colour core.</p>
        </header>

        <ol className="mb-2 grid grid-cols-3 gap-2" aria-label="Progress">
          {STEPS.map((label, index) => {
            const number = index + 1;
            const active = step === number;
            const done = step > number;
            return (
              <li key={label}>
                <button
                  type="button"
                  disabled={number > unlocked}
                  onClick={() => setStep(number)}
                  aria-current={active ? 'step' : undefined}
                  className={`flex min-h-11 w-full items-center justify-center gap-2 rounded-full border px-2 text-sm ${
                    active
                      ? 'border-[#e2c275] bg-[#e2c275] font-semibold text-black'
                      : done
                        ? 'border-[#e2c275]/70 text-[#e2c275]'
                        : 'border-white/15 text-gray-400'
                  } disabled:cursor-not-allowed disabled:opacity-50`}
                >
                  <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold ${active ? 'bg-black/15' : 'bg-white/10'}`}>
                    {number}
                  </span>
                  <span className="truncate">{label}</span>
                </button>
              </li>
            );
          })}
        </ol>
        <p className="mb-4 text-center text-xs text-gray-400">
          Step {step} of 3. Going back keeps your artwork, crop, and colours.
        </p>

        <div className={step === 1 ? 'block' : 'hidden'}>
          <div
            {...getRootProps()}
            className={`cursor-pointer rounded-xl border-2 border-dashed p-6 text-center transition sm:p-10 ${
              isDragActive ? 'border-[#e2c275] bg-white/10 text-white' : 'border-[#e2c275]/40 text-gray-200'
            }`}
          >
            <input {...getInputProps()} />
            <p className="text-base font-semibold">{isDragActive ? 'Drop the image here' : 'Drag an image here, or tap to choose one'}</p>
            <p className="mt-1 text-xs text-gray-400">JPG, PNG, or WebP</p>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {SAMPLES.map((sample) => (
              <button
                key={sample.filename}
                type="button"
                onClick={() => { void useSample(sample.src); }}
                className="flex min-h-11 items-center gap-3 rounded-xl border border-white/10 bg-black/20 p-2 text-left hover:border-[#e2c275]/60"
              >
                <img src={sample.src} alt="" className="h-16 w-16 shrink-0 rounded-md object-cover" />
                <span>
                  <span className="block text-sm font-semibold text-[#e2c275]">{sample.title}</span>
                  <span className="block text-xs text-gray-400">Try sample artwork</span>
                </span>
              </button>
            ))}
          </div>

          {image && (
            <img src={image} alt="Selected artwork" className="mx-auto mt-4 max-h-56 w-full rounded-lg object-contain" />
          )}
        </div>

        {step === 2 && (
          <div>
            <h2 className="text-lg font-semibold text-[#e2c275]">Crop to the box faces</h2>
            <p className="mt-1 text-sm text-gray-300">
              Drag the frame and the gold corners. It stays at the three-face ratio: front, spine, then back. Each face becomes its own colour-core STL.
            </p>
            {image ? (
              <ImageCropper
                key={imageToken}
                imageSrc={image}
                initialBox={cropBox}
                onBoxChange={setCropBox}
                setCrops={setCrops}
              />
            ) : (
              <p className="mt-4 text-sm text-gray-400">Choose an image in step 1 first.</p>
            )}
            {image && !crops[0] && <p className="mt-3 text-xs text-gray-400">Preparing the crop…</p>}
          </div>
        )}

        <div className={step === 3 ? 'block min-w-0' : 'hidden'}>
          <div className="grid min-w-0 grid-cols-1 items-start gap-6 lg:grid-cols-2">
            <div className="min-w-0">
              {previewReady && (
                <SpinningBoxWithTextures textures={previewTextures} glbPath="/models/edh_box_v1.glb" />
              )}
              <p className="mt-2 text-center text-xs text-gray-400">Drag to turn the box. One finger rotates it.</p>
              {layered[0] && (
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {layered.map((src, index) => (
                    <img
                      key={`layered-face-${index}`}
                      src={src}
                      alt={`Filament preview of face ${index + 1}`}
                      className="w-full rounded bg-black/40"
                    />
                  ))}
                </div>
              )}
              {faceSizes.some(Boolean) && (
                <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4">
                  <h2 className="text-sm font-semibold text-[#e2c275]">One model per face</h2>
                  <ul className="mt-1 space-y-1 text-sm">
                    {faceSizes.map((size, index) => (
                      <li key={FACE_NAMES[index]}>
                        {FACE_NAMES[index]}
                        {size ? ` ${size.widthMm.toFixed(2)} × ${size.heightMm.toFixed(2)} mm` : ' — waiting for the crop'}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-1 text-xs text-gray-400">
                    Height is the shared face height ({settings.height} mm). Width follows that crop.
                    Border {settings.borderWidth} mm wide and {settings.borderDepth} mm tall, inside the plate.
                    Detail {settings.detailSize} mm, capped so the mesh stays in browser memory.
                  </p>
                  <p className="mt-1 text-xs text-gray-400">
                    First layer {settings.baseLayerHeight} mm, then {settings.layerHeight} mm.
                    Colour core {layerCount} layers. Min depth {settings.minDepth} mm, max depth {settings.maxDepth} mm.
                    {' '}
                    {settingsSource === 'api' ? 'Loaded from shop print settings.' : 'Built-in defaults. The shop API is not configured in this session.'}
                  </p>
                  <p className="mt-2 text-xs text-gray-400">
                    The download is front.stl, spine.stl, and back.stl (each a watertight colour core), details.txt with a swap section per face, filament-layers.json, and the six face images.
                  </p>
                  <ol className="mt-3 space-y-1 text-xs text-gray-200">
                    <li>Start with {shortFilamentName(coreStops[0]?.filament ?? { name: 'filament', td: 0 })}</li>
                    {coreStops.slice(0, -1).map((stop, index) => (
                      <li key={`${stop.endLayer}-${index}`}>
                        Layer {stop.endLayer} ({formatSwapDepth(stop.endLayer, settings)} mm) → {shortFilamentName(coreStops[index + 1].filament)}
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
            <div className="min-w-0">
              <ColorCore
                filaments={filaments}
                source={source}
                layers={layers}
                stops={stops}
                layerCount={layerCount}
                settings={settings}
                onChange={(nextLayers, nextStops) => {
                  setLayers(nextLayers);
                  setStops(nextStops);
                }}
              />
            </div>
          </div>
          {exportError && <p className="mt-3 text-sm text-amber-200">{exportError}</p>}
          <button
            type="button"
            disabled={!crops[0]}
            onClick={addToCart}
            className="mt-4 min-h-11 w-full rounded-md border border-[#e2c275]/50 px-4 text-sm text-[#e2c275] hover:bg-white/5 disabled:opacity-40 sm:w-auto"
          >
            Add to cart
          </button>
        </div>
      </div>

      <div className="sticky bottom-0 z-20 border-t border-white/10 bg-[#12182c]/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl gap-3">
          <button
            type="button"
            disabled={step === 1}
            onClick={() => setStep((current) => Math.max(1, current - 1))}
            className="min-h-11 flex-1 rounded-md border border-white/20 px-4 text-sm disabled:opacity-40 sm:flex-none sm:px-6"
          >
            Back
          </button>
          {step < 3 ? (
            <button
              type="button"
              disabled={step === 1 ? !image : !crops[0]}
              onClick={() => setStep((current) => Math.min(3, current + 1))}
              className="min-h-11 flex-[2] rounded-md bg-[#e2c275] px-4 text-sm font-semibold text-black disabled:bg-gray-500 disabled:text-gray-200 sm:flex-none sm:px-8"
            >
              Next
            </button>
          ) : (
            <button
              type="button"
              disabled={!crops[0] || exporting}
              onClick={() => { void download(); }}
              className="min-h-11 flex-[2] rounded-md bg-[#e2c275] px-4 text-sm font-semibold text-black disabled:bg-gray-500 disabled:text-gray-200 sm:flex-none sm:px-8"
            >
              {exporting ? 'Building STL files…' : 'Download print bundle'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
