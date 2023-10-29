import { performApi } from '@/api/support';
import cls from '@/generic/cls';
import {
  Button,
  ButtonGroup,
  Content,
  Dialog,
  Divider,
  Heading,
  ProgressBar,
  useDialogContainer,
} from '@adobe/react-spectrum';
import { useId, useState } from 'react';
import SparkMD5 from 'spark-md5';
import {
  createImport,
  getImportStatus,
  startImport,
  uploadImport,
} from './api/importerApi';

const acceptTypes = ['.gpx', 'application/gpx+xml'];

type Stage =
  | 'pre'
  | 'preparing'
  | 'setting-up-upload'
  | 'uploading'
  | 'starting-conversion'
  | 'converting'
  | 'failed';

export function ImportDialog({ mapId }: { mapId: string }) {
  const dialog = useDialogContainer();

  const [file, setFile] = useState<File | null>(null);
  const onInput: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const file = e.target.files?.[0] ?? null;
    setFile(file);
  };

  const [stage, setStage] = useState<Stage>('pre');

  const inputId = useId();

  return (
    <Dialog>
      <Heading>Import</Heading>
      <Divider />
      <Content>
        <label
          className={cls(
            'block mb-2 text-sm font-medium',
            stage === null ? 'text-gray-900' : 'text-gray-500',
          )}
          htmlFor={inputId}
        >
          Upload GPX file
        </label>
        <input
          className={cls(
            'block w-full text-gray-900 border border-gray-300 rounded-lg outline-none cursor-pointer text-md bg-gray-50 focus:outline-none',
            'file:border-0 file:py-1 file:px-2',
          )}
          id={inputId}
          type="file"
          accept={acceptTypes.join(',')}
          onChange={onInput}
          disabled={stage !== 'pre'}
        />

        <div className="mt-0.5 flex justify-end text-gray-600 text-sm h-5">
          <span>{file && humanByteSize(file.size, 1)}</span>
        </div>

        {stage != 'pre' && (
          <div className="mt-2">
            <div
              className={cls(
                'block mb-2 text-sm font-medium',
                stage === 'failed' ? 'text-red-700' : 'text-gray-900',
              )}
            >
              {stageDisplayName(stage)}
            </div>
            {stage !== 'failed' && (
              <ProgressBar isIndeterminate aria-label="working" />
            )}
          </div>
        )}
      </Content>
      <ButtonGroup>
        <Button variant="secondary" onPress={dialog.dismiss}>
          Cancel
        </Button>
        <Button
          variant="accent"
          onPress={() =>
            doImport(mapId, file!, setStage)
              .then(() => dialog.dismiss())
              .catch((err) => {
                console.error(err);
                setStage('failed');
              })
          }
          isDisabled={stage !== 'pre'}
        >
          Import
        </Button>
      </ButtonGroup>
    </Dialog>
  );
}

function stageDisplayName(stage: Stage): string {
  switch (stage) {
    case 'pre':
      return 'Select a file';
    case 'preparing':
      return 'Preparing file';
    case 'setting-up-upload':
      return 'Setting up upload';
    case 'uploading':
      return 'Uploading file';
    case 'starting-conversion':
      return 'Starting conversion';
    case 'converting':
      return 'Converting file';
    case 'failed':
      return 'Import failed';
  }
}

async function doImport(
  mapId: string,
  file: File,
  onProgress: (stage: Stage) => any,
) {
  if (!file) return;

  onProgress('preparing');
  const data = await readFile(file);
  const contentMD5 = computeContentMD5(data);

  onProgress('setting-up-upload');
  const uploadInfo = await createImport(mapId, 'gpx', contentMD5);

  onProgress('uploading');
  await uploadImport(uploadInfo, contentMD5, data);

  onProgress('starting-conversion');
  let status = await startImport(uploadInfo);

  while (true) {
    switch (status.status) {
      case 'failed':
        throw new Error(status.statusMessage);
      case 'complete':
        return;
      case 'not-started':
      case 'in-progress':
        onProgress('converting');
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
    status = await getImportStatus(uploadInfo);
  }
}

const readFile = async (file: File): Promise<ArrayBuffer> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (evt) => {
      resolve(evt.target?.result as ArrayBuffer);
    };
    reader.onerror = (evt) => {
      reject(evt.target?.error);
    };
    reader.readAsArrayBuffer(file);
  });

const computeContentMD5 = (data: ArrayBuffer) => {
  const hasher = new SparkMD5.ArrayBuffer();
  hasher.append(data);
  const hashBinary = hasher.end(true);
  return btoa(hashBinary);
};

function humanByteSize(bytes: number, decimalPlaces: number) {
  if (Math.abs(bytes) < 1024) {
    return bytes + ' B';
  }

  const units = ['KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB'];
  let u = -1;
  const r = 10 ** decimalPlaces;

  do {
    bytes /= 1024;
    ++u;
  } while (Math.round(Math.abs(bytes) * r) / r >= 1024 && u < units.length - 1);

  return bytes.toFixed(decimalPlaces) + ' ' + units[u];
}
