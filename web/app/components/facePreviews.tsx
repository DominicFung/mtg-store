const LABELS = ['Right side', 'Spine', 'Left side'];

/**
 * The aspect box is a div, not the img. Safari paints a broken-image icon when
 * aspect-ratio and object-fit sit on the img, even after the file loads.
 */
export default function FacePreviews({ urls }: { urls: string[] }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {urls.map((src, index) => (
        src ? (
          <div key={index} className="relative aspect-[4/5] overflow-hidden rounded bg-black/40">
            <img src={src} alt={LABELS[index] ?? 'Face of the print'} className="absolute inset-0 h-full w-full object-cover" />
          </div>
        ) : <div key={index} className="aspect-[4/5] rounded bg-black/40" />
      ))}
    </div>
  );
}
