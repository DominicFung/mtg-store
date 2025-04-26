import { Rnd } from "react-rnd";
import { useEffect, useRef, useState } from "react";
import JSZip from "jszip";

interface Props {
  imageSrc: string,



  setCrops: (a: [string, string, string]) => void
}

const BOX_WIDTHS = [293, 255, 293];
const ORIGINAL_HEIGHT = 326;
const TOTAL_ORIGINAL_WIDTH = BOX_WIDTHS.reduce((a, b) => a + b, 0);

const DOWNLOAD = false

export default function GroupedCropBoxes({ imageSrc, setCrops }: Props) {
  const [imgDimensions, setImgDimensions] = useState({ width: 0, height: 0 });
  const [groupBox, setGroupBox] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [croppedImages, setCroppedImages] = useState<string[]>([]);

  // const setGroupBox = (s: {x: number, y: number, width: number, height: number}) => {
  //   console.log(`setGroupBox ${s.x}, ${s.y}, ${s.width}, ${s.height}`)
  //   _setGroupBox(s)
  // }

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
    if (imgDimensions.width && imgDimensions.height) {
      const initialBox = calculateFittingSize(
        imgDimensions.width,
        imgDimensions.height
      );
      setGroupBox(initialBox);
    }
  }, [imgDimensions]);

  useEffect(() => {
    if (imageSrc && groupBox.width && groupBox.height) {
      handleCropAndDownload();
    }
  }, [groupBox, imageSrc]);

  const handleCropAndDownload = async () => {
    const img = new Image();
    img.src = imageSrc;
    await img.decode();

    const scaleX = img.naturalWidth / imgDimensions.width;
    const scaleY = img.naturalHeight / imgDimensions.height;

    let xOffset = 0;
    const previews: string[] = [];
    const zip = new JSZip();
    let crops: [string, string, string] = ["", "", ""]

    for (let i = 0; i < 3; i++) {
      const widthRatio = BOX_WIDTHS[i] / TOTAL_ORIGINAL_WIDTH;
      const boxWidth = groupBox.width * widthRatio;

      const canvas = document.createElement("canvas");
      canvas.width = boxWidth * scaleX;
      canvas.height = groupBox.height * scaleY;

      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(
        img,
        (groupBox.x + xOffset) * scaleX,
        groupBox.y * scaleY,
        boxWidth * scaleX,
        groupBox.height * scaleY,
        0,
        0,
        canvas.width,
        canvas.height
      );

      const dataUrl = canvas.toDataURL("image/png");
      previews.push(dataUrl);

      // Add to ZIP
      const base64Data = dataUrl.replace(/^data:image\/png;base64,/, "");
      zip.file(`crop-${i + 1}.png`, base64Data, { base64: true });

      // add to cropped images
      crops[i] = dataUrl

      xOffset += boxWidth;
    }

    setCroppedImages(previews);
    setCrops(crops)

    //Generate and download ZIP
    if (DOWNLOAD) {
      const content = await zip.generateAsync({ type: "blob" });
      const zipUrl = URL.createObjectURL(content);
      const link = document.createElement("a");
      link.href = zipUrl;
      link.download = "cropped-images.zip";
      link.click();
    }
  };

  return (
    <div className="relative mt-4">
      <img
        src={imageSrc}
        alt="Uploaded"
        onLoad={(e) => {
          const { width, height } = e.currentTarget;
          setImgDimensions({ width, height });
        }}
        style={{ width: "100%", maxWidth: "800px" }}
      />

      <div
        className="absolute top-0 left-0"
        style={{
          width: imgDimensions.width,
          height: imgDimensions.height,
        }}
      >
        {groupBox.width > 0 && (
          <Rnd
            size={{ width: groupBox.width, height: groupBox.height }}
            position={{ x: groupBox.x, y: groupBox.y }}
            onDragStop={(_, d) => {
              const maxX = imgDimensions.width - groupBox.width;
              const maxY = imgDimensions.height - groupBox.height;
              setGroupBox({
                ...groupBox,
                x: Math.max(0, Math.min(d.x, maxX)),
                y: Math.max(0, Math.min(d.y, maxY)),
              });
            }}
            onResizeStop={(_, __, ref, ___, pos) => {
              let newWidth = parseFloat(ref.style.width);
              let newHeight = parseFloat(ref.style.height);

              const scaleX = imgDimensions.width / TOTAL_ORIGINAL_WIDTH;
              const scaleY = imgDimensions.height / ORIGINAL_HEIGHT;
              const maxScale = Math.min(scaleX, scaleY);

              const maxW = TOTAL_ORIGINAL_WIDTH * maxScale;
              const maxH = ORIGINAL_HEIGHT * maxScale;

              newWidth = Math.min(newWidth, maxW);
              newHeight = Math.min(newHeight, maxH);

              setGroupBox({
                width: newWidth,
                height: newHeight,
                x: Math.max(0, Math.min(pos.x, imgDimensions.width - newWidth)),
                y: Math.max(0, Math.min(pos.y, imgDimensions.height - newHeight)),
              });
            }}
            lockAspectRatio={TOTAL_ORIGINAL_WIDTH / ORIGINAL_HEIGHT}
            bounds="parent"
            style={{
              border: "1px dashed #333",
              display: "flex",
              flexDirection: "row",
              position: "absolute",
              background: "rgba(255,255,255,0.02)",
            }}
          >
            {BOX_WIDTHS.map((w, i) => {
              const widthRatio = w / TOTAL_ORIGINAL_WIDTH;
              return (
                <div
                  key={i}
                  style={{
                    width: `${widthRatio * 100}%`,
                    height: "100%",
                    border: "2px solid red",
                    boxSizing: "border-box",
                  }}
                />
              );
            })}
          </Rnd>
        )}
      </div>
    </div>
  );
}
