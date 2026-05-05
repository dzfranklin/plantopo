/* eslint-disable @typescript-eslint/no-explicit-any */
import { type Dispatch, type SetStateAction, useRef, useState } from "react";

import ImageUploader from "@/components/ImageUploader";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

interface MockInfo {
  id: string;
  info: any;
}

export default function DevImageUploaderPage() {
  const [mockMode, setMockMode] = useState(false);

  const [mocks, setMocks] = useState<MockInfo[]>([]);
  const [selectedMockId, setSelectedMockId] = useState<string | null>(null);
  const updateFns = useRef(new Map<string, Dispatch<SetStateAction<any>>>());

  const selectedMock = selectedMockId
    ? mocks.find(m => m.id === selectedMockId)!
    : null;

  const updateMock = (id: string, newInfo: any) => {
    const prev = mocks.find(m => m.id === id)!;
    if (typeof newInfo === "function") newInfo = newInfo(prev.info);
    setMocks(prevMocks =>
      prevMocks.map(m => (m.id === id ? { ...m, info: newInfo } : m)),
    );
    updateFns.current.get(id)!(newInfo);
  };

  const mockProcessFile = async (
    info: any,
    { updateFn: updateFn }: { updateFn: Dispatch<SetStateAction<any>> },
  ) => {
    const id = info.localId;
    updateFns.current.set(id, updateFn);
    setMocks(prev => [...prev, { id, info }]);
  };

  return (
    <div className="p-8">
      <h1 className="mb-2 text-2xl font-bold">Image Uploader</h1>

      <div className="mb-2">
        <Label>
          <Checkbox
            checked={mockMode}
            onCheckedChange={v => setMockMode(v === true)}
          />
          mock
        </Label>
      </div>

      {mockMode && (
        <div className="flex flex-wrap gap-4">
          <Select
            value={selectedMockId ?? "null"}
            onValueChange={value =>
              setSelectedMockId(value === "null" ? null : value)
            }>
            <Select.Trigger className="w-[15rem]">
              <Select.Value placeholder="Select a mock" />
            </Select.Trigger>
            <Select.Content>
              <Select.Item value="null">Select a mock</Select.Item>
              {mocks.map(mock => (
                <Select.Item key={mock.id} value={mock.id}>
                  {mock.info.name}
                </Select.Item>
              ))}
            </Select.Content>
          </Select>

          {selectedMock && (
            <>
              <Select
                value={selectedMock.info.stage}
                onValueChange={value =>
                  updateMock(selectedMock.id, (p: any) =>
                    value === "error"
                      ? {
                          ...p,
                          stage: value,
                          error: "Failed to request upload",
                        }
                      : { ...p, stage: value, error: undefined },
                  )
                }>
                <Select.Trigger className="w-[15rem]">
                  <Select.Value />
                </Select.Trigger>
                <Select.Content>
                  <Select.Item value="preparing">preparing</Select.Item>
                  <Select.Item value="uploading">uploading</Select.Item>
                  <Select.Item value="confirming">confirming</Select.Item>
                  <Select.Item value="done">done</Select.Item>
                  <Select.Item value="error">error</Select.Item>
                </Select.Content>
              </Select>
            </>
          )}
        </div>
      )}

      <div className="mt-4">
        <ImageUploader
          forTesting={{ processFile: mockMode ? mockProcessFile : undefined }}
          key={String(mockMode)}
        />
      </div>
    </div>
  );
}
