import { performApi } from '@/api/support';

interface ImportStatus {
  id: string;
  mapId: string;
  status: 'not-started' | 'in-progress' | 'complete' | 'failed';
  statusMessage?: string;
}

interface CreateImportResponse extends ImportStatus {
  uploadURL: string;
}

export async function createImport(
  mapId: string,
  format: string,
  contentMD5: string,
): Promise<CreateImportResponse> {
  return await performApi('POST', ['map', mapId, 'import'], undefined, {
    format: 'gpx',
    contentMD5,
  });
}

export async function uploadImport(
  status: CreateImportResponse,
  contentMD5: string,
  data: ArrayBuffer,
): Promise<void> {
  await fetch(status.uploadURL, {
    method: 'PUT',
    headers: {
      'Content-MD5': contentMD5,
    },
    body: data,
  });
}

export async function startImport(status: ImportStatus): Promise<ImportStatus> {
  return await performApi('POST', [
    'map',
    status.mapId,
    'import',
    status.id,
    'start',
  ]);
}

export async function getImportStatus(
  prevStatus: ImportStatus,
): Promise<ImportStatus> {
  return await performApi('GET', [
    'map',
    prevStatus.mapId,
    'import',
    prevStatus.id,
  ]);
}
