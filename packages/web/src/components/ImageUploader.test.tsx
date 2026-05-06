import { act, cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ImageUploader from "./ImageUploader";
import { renderWithProviders } from "@/test/render";

beforeEach(() => {
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:fake");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  cleanup();
});

function makeProcessFileMock(): ((
  info: any,
  options: { updateFn: (info: any) => void },
) => Promise<any>) & {
  updateFn: (info: any) => void;
  resolve: () => void;
  reject: (err: unknown) => void;
} {
  let capturedUpdateFn: ((info: any) => void) | null = null;
  let resolvePromise!: () => void;
  let rejectPromise!: (err: unknown) => void;

  const mock: any = vi.fn(
    (_info: any, { updateFn }: { updateFn: (info: any) => void }) => {
      capturedUpdateFn = updateFn;
      return new Promise<void>((res, rej) => {
        resolvePromise = res;
        rejectPromise = rej;
      });
    },
  );

  // Use defineProperty so the getter is live (Object.assign would invoke it immediately)
  Object.defineProperty(mock, "updateFn", {
    get(): (info: any) => void {
      return capturedUpdateFn!;
    },
  });
  mock.resolve = () => resolvePromise();
  mock.reject = (err: unknown) => rejectPromise(err);

  return mock;
}

function getFileInput(): HTMLInputElement {
  return document.querySelector<HTMLInputElement>('input[type="file"]')!;
}

async function dropFile(file: File) {
  await act(async () => {
    fireEvent.change(getFileInput(), { target: { files: [file] } });
  });
}

const testFile = () => new File(["x"], "photo.jpg", { type: "image/jpeg" });

describe("ImageUploader", () => {
  it("shows the dropzone prompt initially with no file cards", async () => {
    renderWithProviders(<ImageUploader />);
    expect(
      await screen.findByText("Drag photos here, or click to select"),
    ).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("shows a progress bar after a file is dropped", async () => {
    const mock = makeProcessFileMock();
    renderWithProviders(<ImageUploader forTesting={{ processFile: mock }} />);

    await dropFile(testFile());

    expect(mock).toHaveBeenCalledOnce();
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

  it("reflects upload progress and transitions to done", async () => {
    const mock = makeProcessFileMock();
    renderWithProviders(<ImageUploader forTesting={{ processFile: mock }} />);

    await dropFile(testFile());

    await act(async () => {
      mock.updateFn({ stage: "uploading", uploadProgress: 0.5 });
    });
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "50",
    );

    await act(async () => {
      mock.updateFn({ stage: "confirming", uploadProgress: undefined });
    });
    expect(screen.getByRole("progressbar")).not.toHaveAttribute(
      "aria-valuenow",
    );

    await act(async () => {
      mock.updateFn({ stage: "done", uploadProgress: undefined });
      mock.resolve();
    });
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("shows default error message when processFile rejects", async () => {
    const mock = makeProcessFileMock();
    renderWithProviders(<ImageUploader forTesting={{ processFile: mock }} />);

    await dropFile(testFile());

    await act(async () => {
      mock.reject(new Error("network failure"));
    });

    expect(screen.getByText("An error occurred")).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("preserves a specific error message set by processFile before rejecting", async () => {
    const mock = makeProcessFileMock();
    renderWithProviders(<ImageUploader forTesting={{ processFile: mock }} />);

    await dropFile(testFile());

    // processFile sets the error stage itself before rejecting
    await act(async () => {
      mock.updateFn({
        stage: "error",
        error: "Failed to read image dimensions",
      });
      mock.reject(new Error("ignored as updateFn already set"));
    });

    expect(
      screen.getByText("Failed to read image dimensions"),
    ).toBeInTheDocument();
  });

  it("renders a card for each file in a multi-file drop", async () => {
    let callCount = 0;
    const mocks = [makeProcessFileMock(), makeProcessFileMock()];
    const combinedMock = vi.fn((info, opts) => mocks[callCount++]!(info, opts));

    renderWithProviders(
      <ImageUploader forTesting={{ processFile: combinedMock }} />,
    );

    await act(async () => {
      fireEvent.change(getFileInput(), {
        target: {
          files: [
            new File(["a"], "a.jpg", { type: "image/jpeg" }),
            new File(["b"], "b.jpg", { type: "image/jpeg" }),
          ],
        },
      });
    });

    expect(combinedMock).toHaveBeenCalledTimes(2);
    expect(screen.getAllByRole("progressbar")).toHaveLength(2);
  });
});
