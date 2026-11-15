import { Rnd } from 'react-rnd';
import { useEffect, useRef, useState } from 'react';
import {
  BOX_FACE_HEIGHT,
  BOX_FACE_WIDTHS,
  BOX_WRAP_WIDTH,
  defaultCropBox,
  subjectBounds,
  type SubjectBounds,
} from '../../../packages/print-core/src/outpaint';
import { toDrawableSrc } from '../lib/drawableImage';

export type CropBox = { x: number; y: number; width: number; height: number };

interface Props {
  imageSrc: string;
  setCrops: (crops: [string, string, string]) => void;
  onFrontSize?: (size: { width: number; height: number }) => void;
  initialBox?: CropBox | null;
  onBoxChange?: (box: CropBox) => void;
  subject?: SubjectBounds | null;
  onError?: (message: string) => void;
}

const FACE_LABELS = ['Right', 'Spine', 'Left'];

const HANDLE = {
  width: 28,
  height: 28,
  borderRadius: 6,
  background: 'rgba(226, 194, 117, 0.95)',
  border: '2px solid #1a1a2e',
};

export default function GroupedCropBoxes({
  imageSrc,
  setCrops,
  onFrontSize,
  initialBox,
  onBoxChange,
  subject,
  onError,
}: Props) {
  const [drawable, setDrawable] = useState<string | null>(null);
  const [imgDimensions, setImgDimensions] = useState({ width: 0, height: 0 });
  const [groupBox, setGroupBox] = useState<CropBox>(
    initialBox && initialBox.width > 0 ? initialBox : { x: 0, y: 0, width: 0, height: 0 },
  );
  const skipFit = useRef(Boolean(initialBox && initialBox.width > 0));
  const setCropsRef = useRef(setCrops);
  const onFrontSizeRef = useRef(onFrontSize);
  const onBoxChangeRef = useRef(onBoxChange);
  const onErrorRef = useRef(onError);
  const subjectRef = useRef(subject);
  setCropsRef.current = setCrops;
  onFrontSizeRef.current = onFrontSize;
  onBoxChangeRef.current = onBoxChange;
  onErrorRef.current = onError;
  subjectRef.current = subject;

  const commitBox = (box: CropBox) => {
    setGroupBox(box);
    onBoxChangeRef.current?.(box);
  };

  const fail = (error: unknown) => {
    const message = error instanceof Error ? error.message : 'The crop could not be prepared. Try again.';
    onErrorRef.current?.(message);
  };

  useEffect(() => {
    let cancelled = false;
    let created: string | null = null;
    setDrawable(null);
    toDrawableSrc(imageSrc).then((src) => {
      if (cancelled) {
        if (src.startsWith('blob:')) URL.revokeObjectURL(src);
        return;
      }
      if (src.startsWith('blob:') && src !== imageSrc) created = src;
      setDrawable(src);
    }).catch((error) => {
      if (!cancelled) fail(error);
    });
    return () => {
      cancelled = true;
      if (created) URL.revokeObjectURL(created);
    };
  }, [imageSrc]);

  useEffect(() => {
    if (!drawable || !imgDimensions.width || !imgDimensions.height || skipFit.current) return;
    let cancelled = false;
    const fit = async () => {
      try {
        const bounds = subjectRef.current ?? await readSubject(drawable);
        if (cancelled) return;
        skipFit.current = true;
        commitBox(defaultCropBox(imgDimensions.width, imgDimensions.height, bounds));
      } catch (error) {
        if (!cancelled) fail(error);
      }
    };
    void fit();
    return () => {
      cancelled = true;
    };
  }, [drawable, imgDimensions]);

  useEffect(() => {
    if (!drawable || !groupBox.width || !groupBox.height || !imgDimensions.width || !imgDimensions.height) return;
    let cancelled = false;

    const crop = async () => {
      try {
        const img = new Image();
        img.src = drawable;
        await img.decode();
        if (cancelled) return;

        const scaleX = img.naturalWidth / imgDimensions.width;
        const scaleY = img.naturalHeight / imgDimensions.height;
        let xOffset = 0;
        const crops: [string, string, string] = ['', '', ''];
        let front = { width: 0, height: 0 };

        for (let i = 0; i < 3; i += 1) {
          const widthRatio = BOX_FACE_WIDTHS[i] / BOX_WRAP_WIDTH;
          const boxWidth = groupBox.width * widthRatio;
          const faceAspect = BOX_FACE_WIDTHS[i] / BOX_FACE_HEIGHT;
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(boxWidth * scaleX));
          canvas.height = Math.max(1, Math.round(canvas.width / faceAspect));
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error('The crop could not be prepared. Try again.');
          ctx.drawImage(
            img,
            (groupBox.x + xOffset) * scaleX,
            groupBox.y * scaleY,
            boxWidth * scaleX,
            groupBox.height * scaleY,
            0,
            0,
            canvas.width,
            canvas.height,
          );
          crops[i] = canvas.toDataURL('image/png');
          if (i === 0) front = { width: canvas.width, height: canvas.height };
          xOffset += boxWidth;
        }

        if (cancelled) return;
        setCropsRef.current(crops);
        onFrontSizeRef.current?.(front);
      } catch (error) {
        if (!cancelled) fail(error instanceof DOMException
          ? new Error('The crop could not be prepared. Try again.')
          : error);
      }
    };

    void crop();
    return () => {
      cancelled = true;
    };
  }, [groupBox, drawable, imgDimensions]);

  return (
    <div className="relative mt-2 w-full max-w-3xl">
      {drawable && (
        <img
          src={drawable}
          alt="Artwork to crop"
          draggable={false}
          onLoad={(event) => {
            const { width, height } = event.currentTarget;
            setImgDimensions({ width, height });
          }}
          onError={() => fail(new Error('The artwork could not be loaded. Try again.'))}
          className="block h-auto w-full max-w-full"
        />
      )}

      <div
        className="absolute top-0 left-0"
        style={{ width: imgDimensions.width, height: imgDimensions.height }}
      >
        {groupBox.width > 0 && (
          <Rnd
            size={{ width: groupBox.width, height: groupBox.height }}
            position={{ x: groupBox.x, y: groupBox.y }}
            minWidth={72}
            minHeight={72 * BOX_FACE_HEIGHT / BOX_WRAP_WIDTH}
            onDragStop={(_, data) => {
              const maxX = imgDimensions.width - groupBox.width;
              const maxY = imgDimensions.height - groupBox.height;
              commitBox({
                ...groupBox,
                x: Math.max(0, Math.min(data.x, maxX)),
                y: Math.max(0, Math.min(data.y, maxY)),
              });
            }}
            onResizeStop={(_, __, ref, ___, pos) => {
              let newWidth = parseFloat(ref.style.width);
              let newHeight = parseFloat(ref.style.height);
              const scaleX = imgDimensions.width / BOX_WRAP_WIDTH;
              const scaleY = imgDimensions.height / BOX_FACE_HEIGHT;
              const maxScale = Math.min(scaleX, scaleY);
              newWidth = Math.min(newWidth, BOX_WRAP_WIDTH * maxScale);
              newHeight = Math.min(newHeight, BOX_FACE_HEIGHT * maxScale);
              commitBox({
                width: newWidth,
                height: newHeight,
                x: Math.max(0, Math.min(pos.x, imgDimensions.width - newWidth)),
                y: Math.max(0, Math.min(pos.y, imgDimensions.height - newHeight)),
              });
            }}
            lockAspectRatio={BOX_WRAP_WIDTH / BOX_FACE_HEIGHT}
            bounds="parent"
            resizeHandleStyles={{
              topLeft: HANDLE,
              topRight: HANDLE,
              bottomLeft: HANDLE,
              bottomRight: HANDLE,
            }}
            style={{
              border: '1px dashed #e2c275',
              display: 'flex',
              flexDirection: 'row',
              position: 'absolute',
              background: 'rgba(0,0,0,0.12)',
              touchAction: 'none',
            }}
          >
            {BOX_FACE_WIDTHS.map((width, index) => (
              <div
                key={FACE_LABELS[index]}
                style={{
                  width: `${(width / BOX_WRAP_WIDTH) * 100}%`,
                  height: '100%',
                  border: '2px solid #e2c275',
                  boxSizing: 'border-box',
                }}
              >
                <div
                  className="pointer-events-none flex h-full items-center justify-center px-1 text-[11px] font-semibold text-white"
                  style={{ textShadow: '0 1px 2px #000' }}
                >
                  {FACE_LABELS[index]}
                </div>
              </div>
            ))}
          </Rnd>
        )}
      </div>
    </div>
  );
}

async function readSubject(src: string): Promise<SubjectBounds> {
  const image = new Image();
  image.src = src;
  await image.decode();
  const maxEdge = 160;
  const scale = Math.min(1, maxEdge / Math.max(image.naturalWidth, 1));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('The crop could not be prepared. Try again.');
  context.drawImage(image, 0, 0, width, height);
  const pixels = context.getImageData(0, 0, width, height);
  return subjectBounds({ rgba: new Uint8Array(pixels.data), width, height });
}
