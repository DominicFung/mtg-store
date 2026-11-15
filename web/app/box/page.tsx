'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import ImageCropper, { CropBox } from './imageCropper';
import SpinningBoxWithTextures from './spinningBox';
import ColorCore from './colorCore';
import CommanderSearch from './commanderSearch';
import OrderPanel from './orderPanel';
import LidFinish, {
  DEFAULT_BOX_FILAMENT_ID,
  DEFAULT_LOGO_FILAMENT_ID,
  DEFAULT_TEXT_FILAMENT_ID,
  boxFilamentChoices,
  filamentById,
} from './lidFinish';
import { chooseColorCore } from '../../../packages/print-core/src/chooseColors';
import type { ExtendSide, SubjectBounds } from '../../../packages/print-core/src/outpaint';
import { useFilaments } from '../lib/filaments';
import {
  defaultLayerSelection,
  Filament,
  MOCK_FILAMENTS,
} from '../lib/filamentCatalogue';
import { colorCoreLayerCount, evenStops } from '../lib/hueforge';
import { modelSizeForCrop, profileToSettings, resolveProfile, type ResolvedProfile } from '../lib/printGeometry';
import { LAUNCH_PROFILES } from '../lib/printGeometry';
import { renderLayeredCrops } from '../lib/renderLayers';
import { listActiveProfiles, outpaintArt } from '../lib/shopOrders';
import { usePrintSettings } from '../lib/usePrintSettings';

const EMPTY_TEXTURES: [string, string, string] = ['', '', ''];
const STEPS = ['Commander', 'Crop', 'Colours'] as const;

const startingLayers = defaultLayerSelection(MOCK_FILAMENTS);

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
  const [previewReady, setPreviewReady] = useState(false);
  const [coloursTouched, setColoursTouched] = useState(false);
  const [commanderName, setCommanderName] = useState('');
  const [artUrl, setArtUrl] = useState<string | null>(null);
  const [extendSide, setExtendSide] = useState<ExtendSide>('right');
  const [subject, setSubject] = useState<SubjectBounds | null>(null);
  const [flipping, setFlipping] = useState(false);
  const [flipError, setFlipError] = useState('');
  const [cropError, setCropError] = useState('');
  const [retryToken, setRetryToken] = useState(0);
  const [profiles, setProfiles] = useState<ResolvedProfile[]>(() => LAUNCH_PROFILES.map(resolveProfile));
  const [profileId, setProfileId] = useState(LAUNCH_PROFILES[0].id);
  const [boxFilamentId, setBoxFilamentId] = useState(DEFAULT_BOX_FILAMENT_ID);
  const [logoFilamentId, setLogoFilamentId] = useState(DEFAULT_LOGO_FILAMENT_ID);
  const [textFilamentId, setTextFilamentId] = useState(DEFAULT_TEXT_FILAMENT_ID);
  const [lidName, setLidName] = useState('');
  const [lidOpen, setLidOpen] = useState(0);
  const [shot, setShot] = useState<string | null>(null);
  const { filaments, source } = useFilaments();
  const { settings: fallbackSettings } = usePrintSettings();
  const layersRef = useRef(layers);
  layersRef.current = layers;
  const profile = profiles.find((entry) => entry.id === profileId) ?? profiles[0];
  const settings = useMemo(
    () => (profile ? profileToSettings(profile) : fallbackSettings),
    [profile, fallbackSettings],
  );
  const layerCount = profile?.layerCount ?? colorCoreLayerCount(settings);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setImage(reader.result as string);
      setArtUrl(null);
      setSubject(null);
      setCropError('');
      setFlipError('');
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

  useEffect(() => {
    const byId = new Map(filaments.map((filament) => [filament.id, filament]));
    const current = layersRef.current;
    if (current.length >= 2 && current.every((layer) => byId.has(layer.id))) {
      setLayers(current.map((layer) => byId.get(layer.id)!));
      return;
    }
    const next = defaultLayerSelection(filaments);
    setLayers(next);
    setStops(evenStops(next.length, colorCoreLayerCount(fallbackSettings)));
  }, [filaments, fallbackSettings]);

  useEffect(() => {
    if (step === 3) setPreviewReady(true);
  }, [step]);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const nextShot = query.get('shot');
    if (!nextShot) return;
    setShot(nextShot);
    setStep(3);
    setPreviewReady(true);
    setLidName(query.get('name') || 'Dom Fungus');
    const open = query.get('open');
    setLidOpen(nextShot === 'open' ? 0.72 : open ? Number(open) : 0);
    const paint = (label: string, fill: string, width: number) => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = 326;
      const context = canvas.getContext('2d');
      if (!context) return '';
      context.fillStyle = fill;
      context.fillRect(0, 0, width, 326);
      context.fillStyle = '#f4f1e8';
      context.font = 'bold 72px sans-serif';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText(label, width / 2, 163);
      return canvas.toDataURL('image/png');
    };
    setCrops([
      paint('RIGHT', '#2a4f8f', 293),
      paint('SPINE', '#c4a15a', 255),
      paint('LEFT', '#8f2d2a', 293),
    ]);
    setLayered(['', '', '']);
  }, []);

  useEffect(() => {
    if (shot) return;
    if (!crops[0] || layers.length === 0) {
      setLayered((current) => (current[0] ? ['', '', ''] as [string, string, string] : current));
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
  }, [crops, layers, stops, settings, shot]);

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

  const faceSizes = cropPx.map((size) => (
    size ? modelSizeForCrop(size.width, size.height, settings.height) : null
  ));
  const previewTextures: [string, string, string] = layered[0] ? layered : (crops[0] ? crops : EMPTY_TEXTURES);
  const boxChoices = boxFilamentChoices(filaments);
  const boxFilament = boxChoices.find((filament) => filament.id === boxFilamentId) ?? boxChoices[0] ?? null;
  const logoFilament = filamentById(filaments, logoFilamentId, DEFAULT_LOGO_FILAMENT_ID);
  const textFilament = filamentById(filaments, textFilamentId, DEFAULT_TEXT_FILAMENT_ID);

  const unlocked = crops[0] ? 3 : image ? 2 : 1;

  const applyArtwork = (
    src: string,
    name: string,
    detail: { artUrl: string; side: ExtendSide; subject: SubjectBounds },
  ) => {
    setImage(src);
    setCommanderName(name);
    setArtUrl(detail.artUrl);
    setExtendSide(detail.side);
    setSubject(detail.subject);
    setImageToken((current) => current + 1);
    setCrops(['', '', '']);
    setCropPx([null, null, null]);
    setCropBox(null);
    setColoursTouched(false);
    setCropError('');
    setFlipError('');
  };

  const flipSide = async () => {
    if (!artUrl || flipping) return;
    const next: ExtendSide = extendSide === 'left' ? 'right' : 'left';
    setFlipping(true);
    setFlipError('');
    setCropError('');
    try {
      const extended = await outpaintArt(artUrl, next);
      applyArtwork(extended.image, commanderName, {
        artUrl,
        side: extended.side,
        subject: extended.subject,
      });
    } catch (error) {
      setFlipError(error instanceof Error ? error.message : 'Could not extend the other side');
    } finally {
      setFlipping(false);
    }
  };

  const flipControl = artUrl ? (
    <div className="mt-3 flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={() => { void flipSide(); }}
        disabled={flipping}
        className="min-h-9 rounded-full border border-[#e2c275]/70 px-3 text-xs font-semibold text-[#e2c275] disabled:opacity-50"
      >
        {flipping ? 'Extending the other side…' : 'Flip side'}
      </button>
      <span className="text-xs text-gray-400">
        {extendSide === 'left' ? 'Extended on the left, subject on the left.' : 'Extended on the right, subject on the right.'}
      </span>
      {flipError && <span className="text-xs text-red-300">{flipError}</span>}
    </div>
  ) : null;

  useEffect(() => {
    if (!crops[0] || coloursTouched || filaments.length === 0) return;
    let cancelled = false;
    const image = new Image();
    image.src = crops[0];
    image.decode().then(() => {
      const canvas = document.createElement('canvas');
      const width = Math.min(160, image.naturalWidth);
      const height = Math.max(1, Math.round(image.naturalHeight * (width / image.naturalWidth)));
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) return;
      context.drawImage(image, 0, 0, width, height);
      const pixels = context.getImageData(0, 0, width, height).data;
      const choice = chooseColorCore({
        rgba: new Uint8Array(pixels),
        width,
        height,
        filaments,
        settings,
      });
      if (cancelled) return;
      const byId = new Map(filaments.map((filament) => [filament.id, filament]));
      const nextLayers = choice.ids.map((id) => byId.get(id)).filter((filament): filament is Filament => Boolean(filament));
      if (nextLayers.length > 0) {
        setLayers(nextLayers);
        setStops(choice.endLayers);
      }
    }).catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [crops, coloursTouched, filaments, profile?.id, layerCount]);

  useEffect(() => {
    let cancelled = false;
    listActiveProfiles().then((next) => {
      if (cancelled || next.length === 0) return;
      setProfiles(next);
      setProfileId((current) => (next.some((entry) => entry.id === current) ? current : (next.find((entry) => entry.isDefault) ?? next[0]).id));
    }).catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setStops((current) => {
      if (current.length === layers.length && current[current.length - 1] === layerCount) return current;
      return evenStops(layers.length, layerCount);
    });
  }, [layerCount, layers.length]);

  return (
    <div className="min-h-full overflow-x-clip bg-gradient-to-b from-[#1a1a2e] to-[#16213e] font-serif text-white">
      <div className="mx-auto w-full max-w-6xl px-4 py-4 pb-28 sm:px-8 sm:py-8">
        <header className="mb-4 text-center sm:mb-6">
          <h1 className="text-2xl font-bold tracking-wide text-[#e2c275] sm:text-4xl">Commander Deck Box</h1>
          <p className="mt-1 text-sm text-gray-300">Find your commander, crop the three faces, then adjust the colours. We print it.</p>
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
          <CommanderSearch onArtwork={(artwork) => {
            applyArtwork(artwork.src, artwork.name, artwork);
          }} />
          {image && (
            <figure className="mt-4">
              <img src={image} alt={commanderName ? `${commanderName} extended for the box` : 'Selected artwork'} className="mx-auto max-h-72 w-full rounded-lg object-contain" />
              {commanderName && <figcaption className="mt-1 text-center text-xs text-gray-400">{commanderName}, extended on one side</figcaption>}
              {flipControl}
            </figure>
          )}
          <div className="my-4 flex items-center gap-3 text-xs uppercase tracking-wide text-gray-500">
            <span className="h-px flex-1 bg-white/10" />
            or upload your own art
            <span className="h-px flex-1 bg-white/10" />
          </div>
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
        </div>

        {step === 2 && (
          <div>
            <h2 className="text-lg font-semibold text-[#e2c275]">Crop to the box faces</h2>
            <p className="mt-1 text-sm text-gray-300">
              Drag the frame and the gold corners. It stays at the three-face ratio: right, spine, then left.
            </p>
            {image ? (
              <ImageCropper
                key={`${imageToken}-${retryToken}`}
                imageSrc={image}
                initialBox={cropBox}
                onBoxChange={setCropBox}
                subject={subject}
                onError={setCropError}
                setCrops={(next) => {
                  setCropError('');
                  setCrops(next);
                }}
              />
            ) : (
              <p className="mt-4 text-sm text-gray-400">Choose an image in step 1 first.</p>
            )}
            {flipControl}
            {cropError ? (
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <p className="text-sm text-red-300">{cropError}</p>
                <button
                  type="button"
                  onClick={() => {
                    setCropError('');
                    setCrops(['', '', '']);
                    setRetryToken((current) => current + 1);
                  }}
                  className="min-h-9 rounded-full border border-white/20 px-3 text-xs"
                >
                  Try again
                </button>
              </div>
            ) : image && !crops[0] && (
              <p className="mt-3 text-xs text-gray-400">Preparing the crop…</p>
            )}
          </div>
        )}

        <div className={step === 3 ? 'block min-w-0' : 'hidden'}>
          <div className="grid min-w-0 grid-cols-1 items-start gap-6 lg:grid-cols-2">
            <div className="min-w-0">
              {previewReady && boxFilament && logoFilament && textFilament && (
                <SpinningBoxWithTextures
                  textures={previewTextures}
                  glbPath="/models/edh_box_v1.glb"
                  boxColor={boxFilament.hex}
                  logoColor={logoFilament.hex}
                  textColor={textFilament.hex}
                  lidName={lidName}
                  lidOpen={lidOpen}
                  shot={shot}
                />
              )}
              <p className="mt-2 text-center text-xs text-gray-400">Drag to turn the box. One finger rotates it. The lid slides out toward the card window.</p>
              <LidFinish
                filaments={filaments}
                boxId={boxFilament?.id ?? boxFilamentId}
                logoId={logoFilament?.id ?? logoFilamentId}
                textId={textFilament?.id ?? textFilamentId}
                name={lidName}
                open={lidOpen}
                onBox={setBoxFilamentId}
                onLogo={setLogoFilamentId}
                onTextColour={setTextFilamentId}
                onName={setLidName}
                onOpen={setLidOpen}
              />
              {layered[0] && (
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {layered.map((src, index) => (
                    <img
                      key={`layered-face-${index}`}
                      src={src}
                      alt={`Filament preview of the ${['right side', 'spine', 'left side'][index]}`}
                      className="w-full rounded bg-black/40"
                    />
                  ))}
                </div>
              )}
              {commanderName && <p className="mt-2 text-center text-sm text-[#e2c275]">{commanderName}</p>}
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
                  setColoursTouched(true);
                  setLayers(nextLayers);
                  setStops(nextStops);
                }}
              />
            </div>
          </div>
          {profile && (
            <OrderPanel
              crops={crops}
              previews={layered[0] ? layered : crops}
              layers={layers}
              stops={stops}
              profile={profile}
              profiles={profiles}
              onProfile={(id) => {
                setProfileId(id);
                setColoursTouched(false);
              }}
              faceSizes={faceSizes}
              lid={boxFilament && logoFilament && textFilament ? {
                box: boxFilament,
                logo: logoFilament,
                textFilament: textFilament,
                text: lidName,
              } : null}
            />
          )}
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
            <p className="flex flex-[2] items-center text-sm text-gray-300 sm:flex-none">Place the order in the form above.</p>
          )}
        </div>
      </div>
    </div>
  );
}
