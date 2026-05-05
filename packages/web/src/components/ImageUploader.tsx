import { RiCheckboxCircleFill } from "@remixicon/react";
import { useQueryClient } from "@tanstack/react-query";
import { nanoid } from "nanoid";
import { useEffect, useState } from "react";
import { useDropzone } from "react-dropzone";

import { Progress } from "./ui/progress";
import { Skeleton } from "./ui/skeleton";
import logger from "@/logger";
import { type AppTRPCClient, useTRPC, useTRPCClient } from "@/trpc";
import { cn } from "@/util/cn";

interface FileUpload {
  localId: string;
  file: File;
  name: string;
  previewUrl: string;
  linkedTrackId?: string;
  stage: "preparing" | "uploading" | "confirming" | "done" | "error";
  uploadProgress?: number; // 0 - 1
  error?: string;

  // must be set before requesting upload
  exif?: ExifInfo;
  dimensions?: Dimensions;
  sha256?: string;
}

interface Props {
  linkedTrackId?: string;
  className?: string;
  forTesting?: { processFile?: typeof processFile };
}

class UIError extends Error {
  static DEFAULT = "An error occurred";

  constructor(message?: string, opts?: ErrorOptions) {
    super(message ?? UIError.DEFAULT, opts);
    this.name = "ErrorMessage";
  }

  static messageFromUnknown(err: unknown): string {
    return err instanceof UIError ? err.message : UIError.DEFAULT;
  }
}

export default function ImageUploader({
  linkedTrackId,
  className,
  ...props
}: Props) {
  useEffect(() => {
    import("exifr"); // preload
  }, []);

  const trpc = useTRPC();
  const trpcClient = useTRPCClient();
  const queryClient = useQueryClient();
  const [files, setFiles] = useState<FileUpload[]>([]);

  const onDrop = (accepted: File[]) => {
    for (const file of accepted) {
      const info = newFileUpload({ file, linkedTrackId });
      setFiles(prev => [...prev, info]);
      const updateFn = setFilesUpdater(setFiles, info.localId);
      const processFn = props.forTesting?.processFile ?? processFile;
      processFn(info, { updateFn, trpcClient }).then(
        () => {
          queryClient.invalidateQueries(trpc.image.pathFilter());
          queryClient.invalidateQueries(trpc.track.pathFilter());
        },
        err => {
          logger.error({ err, fileName: file.name }, "Failed to process file");
          updateFn(p =>
            p.stage === "error"
              ? p
              : {
                  ...p,
                  stage: "error",
                  error: UIError.messageFromUnknown(err),
                  uploadProgress: undefined,
                },
          );
        },
      );
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [] },
    multiple: true,
  });

  return (
    <div className={cn("mx-auto w-full max-w-xl space-y-3", className)}>
      <div
        {...getRootProps()}
        className={cn(
          "cursor-pointer rounded-lg border-2 border-dashed p-6 text-center text-sm transition-colors",
          isDragActive
            ? "border-blue-500 bg-blue-50 text-blue-700"
            : "border-gray-300 text-gray-500 hover:border-gray-400",
        )}>
        <input {...getInputProps()} />
        {isDragActive
          ? "Drop images here"
          : "Drag photos here, or click to select"}
      </div>

      {files.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {files.map(u => (
            <FileInfo key={u.localId} info={u} />
          ))}
        </div>
      )}
    </div>
  );
}

function FileInfo({ info: u }: { info: FileUpload }) {
  return (
    <div className="relative overflow-hidden rounded border border-gray-200">
      <PreviewImage url={u.previewUrl} />

      {(u.stage === "preparing" ||
        u.stage === "uploading" ||
        u.stage === "confirming") && (
        <div className="absolute inset-2 flex items-start justify-end text-center">
          <Progress
            value={u.uploadProgress ? u.uploadProgress * 100 : undefined}
            indeterminate={u.uploadProgress === undefined}
            className="h-1.5"
          />
        </div>
      )}

      {u.stage === "error" && (
        <div
          className={cn(
            "absolute right-4 bottom-4 left-4 flex items-start justify-center truncate rounded-md px-2 py-1.5 text-center text-sm",
            "bg-red-100 text-red-700",
          )}>
          <span>{u.error}</span>
        </div>
      )}

      {u.stage === "done" && (
        <div className="absolute top-2 right-2">
          <RiCheckboxCircleFill className="size-7 rounded-full bg-white fill-green-700 p-0.25" />
        </div>
      )}
    </div>
  );
}

function PreviewImage({ url }: { url: string }) {
  const [useFallback, setUseFallback] = useState(false);
  if (useFallback) {
    return <Skeleton className="aspect-square w-full" />;
  }
  return (
    <img
      src={url}
      alt=""
      onError={() => setUseFallback(true)}
      className="aspect-square w-full object-cover"
    />
  );
}

function newFileUpload({
  file,
  ...rest
}: { file: File } & Partial<FileUpload>): FileUpload {
  return {
    ...rest,
    localId: nanoid(),
    file,
    name: file.name,
    previewUrl: URL.createObjectURL(file),
    stage: "preparing",
  };
}

async function processFile(
  info: FileUpload,
  {
    updateFn,
    trpcClient,
  }: {
    updateFn: (info: FileUpload) => void;
    trpcClient: AppTRPCClient;
  },
) {
  const { file } = info;

  const update = (fields?: Partial<FileUpload>) => {
    info = { ...info, ...fields };
    updateFn(info);
  };

  update(); // Report initial synchronously available info

  await Promise.all([
    parseExif(file).then(exifInfo => update({ exif: exifInfo })),
    readDimensions(file).then(dimensions => update({ dimensions })),
    computeFileSha256(file).then(sha256 => update({ sha256 })),
  ]);
  update({ stage: "uploading" });

  const { s3Key, uploadUrl } = await requestUpload(trpcClient, info);

  if (!uploadUrl) {
    // Already uploaded
    update({ stage: "done", uploadProgress: undefined });
    return;
  }

  update({ stage: "uploading", uploadProgress: 0 });
  await uploadFile(file, uploadUrl, progress =>
    update({ uploadProgress: progress }),
  );

  update({ stage: "confirming", uploadProgress: undefined });
  await confirmUpload(trpcClient, s3Key);
  update({ stage: "done", uploadProgress: undefined });
}

interface ExifInfo {
  takenAt?: string;
  location?: { lat: number; lng: number };
  exif?: Record<string, unknown>;
}

async function parseExif(file: File): Promise<ExifInfo> {
  let takenAt: string | undefined;
  let location: { lat: number; lng: number } | undefined;
  let exif: Record<string, unknown> | undefined;
  try {
    const exifr = await import("exifr");
    const parsed = await exifr.parse(file, { reviveValues: false });
    if (parsed) {
      if (parsed.errors) {
        logger.warn(
          { errors: parsed.errors },
          "Non-fatal errors parsing EXIF data",
        );
      }

      takenAt = parsed.DateTimeOriginal;

      if (
        typeof parsed.latitude === "number" &&
        typeof parsed.longitude === "number"
      ) {
        location = { lat: parsed.latitude, lng: parsed.longitude };
      }

      // Strip any binary/buffer fields before sending
      const clean: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(parsed)) {
        if (k === "ExifVersion") {
          clean[k] = String.fromCharCode(...(v as Uint8Array));
        } else if (
          typeof v === "string" ||
          typeof v === "number" ||
          typeof v === "boolean"
        ) {
          clean[k] = v;
        }
      }
      exif = clean;
    }
  } catch (err) {
    // EXIF is optional
    logger.warn({ err }, "Failed to parse EXIF data");
  }
  return { takenAt, location, exif };
}

type Dimensions = { width: number; height: number };

async function readDimensions(file: File): Promise<Dimensions> {
  try {
    try {
      const bitmap = await createImageBitmap(file);
      const dimensions = { width: bitmap.width, height: bitmap.height };
      bitmap.close();
      return dimensions;
    } catch (err) {
      logger.warn(
        { err, fileName: file.name, type: file.type },
        "createImageBitmap failed, falling back to EXIF for dimensions",
      );
      const exifr = await import("exifr");
      const exifData = await exifr.parse(file, {
        reviveValues: false,
        pick: ["ImageWidth", "ImageHeight"],
      });
      if (exifData.ImageWidth && exifData.ImageHeight) {
        return { width: exifData.ImageWidth, height: exifData.ImageHeight };
      } else {
        throw new Error("Cannot use exif dimensions as fallback, missing");
      }
    }
  } catch (err) {
    logger.warn({ err, type: file.type }, "Failed to read image dimensions");
    throw new UIError("Failed to read image dimensions", { cause: err });
  }
}

async function computeFileSha256(file: File): Promise<string> {
  const hashBuffer = await crypto.subtle.digest(
    "SHA-256",
    await file.arrayBuffer(),
  );
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

async function requestUpload(client: AppTRPCClient, info: FileUpload) {
  if (!info.sha256 || !info.dimensions || !info.exif) {
    throw new Error("missing upload requirements");
  }
  try {
    return await client.image.requestUpload.mutate({
      linkedTrackId: info.linkedTrackId,
      sha256: info.sha256,
      mimeType: info.file.type,
      size: info.file.size,
      width: info.dimensions.width,
      height: info.dimensions.height,
      takenAt: info.exif?.takenAt,
      location: info.exif?.location,
      exif: info.exif?.exif,
    });
  } catch (err) {
    throw new UIError("Failed to request upload", { cause: err });
  }
}

async function confirmUpload(client: AppTRPCClient, s3Key: string) {
  try {
    await client.image.confirmUpload.mutate({ s3Key });
  } catch (err) {
    throw new UIError("Failed to confirm upload", { cause: err });
  }
}

async function uploadFile(
  file: File,
  url: string,
  onProgress: (progress: number | undefined) => void,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.upload.addEventListener("progress", e => {
      if (e.lengthComputable) onProgress(e.loaded / e.total);
      else onProgress(undefined);
    });
    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new UIError(`Upload failed: ${xhr.status}`));
      }
    });
    xhr.addEventListener("error", () => reject(new UIError("Upload failed")));
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.send(file);
  });
}

function setFilesUpdater(
  setFiles: React.Dispatch<React.SetStateAction<FileUpload[]>>,
  localId: string,
) {
  return (info: Partial<FileUpload> | ((prev: FileUpload) => FileUpload)) =>
    setFiles(prev =>
      prev.map(p =>
        p.localId === localId
          ? typeof info === "function"
            ? info(p)
            : { ...p, ...info }
          : p,
      ),
    );
}
