import { Rnd } from 'react-rnd';
import { useEffect, useRef, useState } from 'react';

export type CropBox = { x: number; y: number; width: number; height: number };

interface Props {
  imageSrc: string;
  setCrops: (crops: [string, string, string]) => void;
  onFrontSize?: (size: { width: number; height: number }) => void;
  initialBox?: CropBox | null;
  onBoxChange?: (box: CropBox) => void;
}

const BOX_WIDTHS = [293, 255, 293];
const ORIGINAL_HEIGHT = 326;
const TOTAL_ORIGINAL_WIDTH = BOX_WIDTHS.reduce((sum, width) => sum + width, 0);
const FACE_LABELS = ['Front', 'Spine', 'Back'];

const HANDLE = {
  width: 28,
  height: 28,
  borderRadius: 6,
  background: 'rgba(226, 194, 117, 0.95)',
  border: '2px solid #1a1a2e',
};

export default function GroupedCropBoxes({ imageSrc, setCrops, onFrontSize, initialBox, onBoxChange }: Props) {
  const [imgDimensions, setImgDimensions] = useState({ width: 0, height: 0 });
  const [groupBox, setGroupBox] = useState<CropBox>(
    initialBox && initialBox.width > 0 ? initialBox : { x: 0, y: 0, width: 0, height: 0 },
  );
  const skipFit = useRef(Boolean(initialBox && initialBox.width > 0));
  const setCropsRef = useRef(setCrops);
  const onFrontSizeRef = useRef(onFrontSize);
  const onBoxChangeRef = useRef(onBoxChange);
  setCropsRef.current = setCrops;
  onFrontSizeRef.current = onFrontSize;
  onBoxChangeRef.current = onBoxChange;

  const commitBox = (box: CropBox) => {
    setGroupBox(box);
    onBoxChangeRef.current?.(box);
  };

  const calculateFittingSize = (imgW: number, imgH: number) => {
    const scaleX = imgW / TOTAL_ORIGINAL_WIDTH;
    const scaleY = imgH / ORIGINAL_HEIGHT;
    const scale = Math.min(scaleX, scaleY);
    const width = TOTAL_ORIGINAL_WIDTH * scale;
    const height = ORIGINAL_HEIGHT * scale;
    const x = (imgW - width) / 2;
    const y = (imgH - height) / 2;
    return { x, y, width, height };
  };

  useEffect(() => {
    if (!imgDimensions.width || !imgDimensions.height || skipFit.current) return;
    skipFit.current = true;
    commitBox(calculateFittingSize(imgDimensions.width, imgDimensions.height));
  }, [imgDimensions]);

  useEffect(() => {
    if (!imageSrc || !groupBox.width || !groupBox.height || !imgDimensions.width || !imgDimensions.height) return;
    let cancelled = false;

    const crop = async () => {
      const img = new Image();
      img.src = imageSrc;
      await img.decode();
      if (cancelled) return;

      const scaleX = img.naturalWidth / imgDimensions.width;
      const scaleY = img.naturalHeight / imgDimensions.height;
      let xOffset = 0;
      const crops: [string, string, string] = ['', '', ''];
      let front = { width: 0, height: 0 };

      for (let i = 0; i < 3; i += 1) {
        const widthRatio = BOX_WIDTHS[i] / TOTAL_ORIGINAL_WIDTH;
        const boxWidth = groupBox.width * widthRatio;
        const faceAspect = BOX_WIDTHS[i] / ORIGINAL_HEIGHT;
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(boxWidth * scaleX));
        canvas.height = Math.max(1, Math.round(canvas.width / faceAspect));
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
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
    };

    void crop();
    return () => {
      cancelled = true;
    };
  }, [groupBox, imageSrc, imgDimensions]);

  return (
    <div className="relative mt-2 w-full max-w-3xl">
      <img
        src={imageSrc}
        alt="Artwork to crop"
        draggable={false}
        onLoad={(event) => {
          const { width, height } = event.currentTarget;
          setImgDimensions({ width, height });
        }}
        className="block h-auto w-full max-w-full"
      />

      <div
        className="absolute top-0 left-0"
        style={{ width: imgDimensions.width, height: imgDimensions.height }}
      >
        {groupBox.width > 0 && (
          <Rnd
            size={{ width: groupBox.width, height: groupBox.height }}
            position={{ x: groupBox.x, y: groupBox.y }}
            minWidth={72}
            minHeight={72 * ORIGINAL_HEIGHT / TOTAL_ORIGINAL_WIDTH}
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
              const scaleX = imgDimensions.width / TOTAL_ORIGINAL_WIDTH;
              const scaleY = imgDimensions.height / ORIGINAL_HEIGHT;
              const maxScale = Math.min(scaleX, scaleY);
              newWidth = Math.min(newWidth, TOTAL_ORIGINAL_WIDTH * maxScale);
              newHeight = Math.min(newHeight, ORIGINAL_HEIGHT * maxScale);
              commitBox({
                width: newWidth,
                height: newHeight,
                x: Math.max(0, Math.min(pos.x, imgDimensions.width - newWidth)),
                y: Math.max(0, Math.min(pos.y, imgDimensions.height - newHeight)),
              });
            }}
            lockAspectRatio={TOTAL_ORIGINAL_WIDTH / ORIGINAL_HEIGHT}
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
            {BOX_WIDTHS.map((width, index) => (
              <div
                key={FACE_LABELS[index]}
                style={{
                  width: `${(width / TOTAL_ORIGINAL_WIDTH) * 100}%`,
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
