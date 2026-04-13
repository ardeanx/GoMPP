'use client';

import { useCallback, useRef, useState } from 'react';
import { ImagePlus } from 'lucide-react';

export function ImageDropzone({
  label,
  description,
  preview,
  onFile,
}: {
  label: string;
  description: string;
  preview?: string;
  onFile: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragActive(false);
      const file = e.dataTransfer.files[0];
      if (file && /\.(svg|png|jpg|jpeg)$/i.test(file.name)) {
        onFile(file);
      }
    },
    [onFile],
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) onFile(file);
    },
    [onFile],
  );

  return (
    <div className="space-y-2">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="flex items-center gap-4">
        {preview && (
          <div className="flex items-center justify-center h-16 px-4 shrink-0">
            <img
              src={preview}
              alt={label}
              className="max-h-12 max-w-[120px] object-contain"
            />
          </div>
        )}
        <div
          className={`flex-1 flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 cursor-pointer transition-colors ${
            dragActive
              ? 'border-primary bg-primary/5'
              : 'border-border hover:border-primary/50'
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
        >
          <ImagePlus className="size-6 text-muted-foreground mb-1.5" />
          <p className="text-sm font-medium">Click or Drag &amp; Drop</p>
          <p className="text-xs text-muted-foreground">
            SVG, PNG, JPG (max. 500×500)
          </p>
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            accept=".svg,.png,.jpg,.jpeg"
            onChange={handleChange}
          />
        </div>
      </div>
    </div>
  );
}
