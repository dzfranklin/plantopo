import { TRPCError } from "@trpc/server";
import { HttpResponse, http } from "msw";
import { beforeEach, expect, it } from "vitest";
import { userEvent } from "vitest/browser";

import ImageUploader, { exportedForTesting } from "./ImageUploader";
import { makeImageInfo, makeRequestUploadResponse } from "@/test/handlers";
import { readTestFile } from "@/test/helpers";
import { server } from "@/test/msw-server";
import { renderWithProviders } from "@/test/render";
import { trpc } from "@/test/trpc";

const S3_URL = "https://s3.example.com/key";
const CDN_URL = "https://cdn.example.com/img.jpg";
const TEST_JPEG = "src/test/fixtures/test.jpg";

const testJpegFile = await readTestFile(TEST_JPEG, { type: "image/jpeg" });

beforeEach(() => {
  server.use(
    http.get(CDN_URL, () => new HttpResponse(testJpegFile, { status: 200 })),
  );
});

it("happy path: uploads and confirms, shows CDN preview after upload", async () => {
  server.use(
    trpc.image.requestUpload(() => ({
      uploadUrl: S3_URL,
      s3Key: "key",
      preview: null,
    })),
    trpc.image.confirmUpload(() =>
      makeImageInfo({
        filename: "test.jpg",
        imageSmallSquare: { src: CDN_URL },
      }),
    ),
    http.put(S3_URL, () => new HttpResponse(null, { status: 200 })),
  );

  const screen = await renderWithProviders(<ImageUploader />);

  const progressBar = screen.getByRole("progressbar");

  expect(progressBar).not.toBeInTheDocument();
  await userEvent.upload(screen.getByLabelText(/photos/i), TEST_JPEG);
  await expect.element(progressBar).toBeInTheDocument();

  await expect.element(progressBar).not.toBeInTheDocument();
  await expect
    .element(screen.getByAltText("test.jpg"))
    .toHaveAttribute("src", CDN_URL);

  expect(trpc.image.requestUpload).toHaveBeenCalledWith(
    expect.objectContaining({
      filename: "test.jpg",
      mimeType: "image/jpeg",
    }),
  );
  expect(trpc.image.confirmUpload).toHaveBeenCalledWith({ s3Key: "key" });
});

it("already uploaded: skips S3 PUT and shows existing preview", async () => {
  server.use(
    trpc.image.requestUpload(() =>
      makeRequestUploadResponse({
        uploadUrl: null,
        s3Key: "key",
        preview: { src: CDN_URL, width: 800, height: 600 },
      }),
    ),
  );

  const screen = await renderWithProviders(<ImageUploader />);
  await userEvent.upload(screen.getByLabelText(/photos/i), TEST_JPEG);

  await expect
    .element(screen.getByAltText("test.jpg"))
    .toHaveAttribute("src", CDN_URL);

  expect(trpc.image.confirmUpload).not.toHaveBeenCalled();
});

it("requestUpload failure shows error message", async () => {
  server.use(
    trpc.image.requestUpload(() => {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    }),
  );

  const screen = await renderWithProviders(<ImageUploader />);
  await userEvent.upload(screen.getByLabelText(/photos/i), TEST_JPEG);

  await expect
    .element(screen.getByText("Failed to request upload"))
    .toBeInTheDocument();
});

it("S3 upload failure shows error message", async () => {
  server.use(
    trpc.image.requestUpload(() =>
      makeRequestUploadResponse({ uploadUrl: S3_URL, s3Key: "key" }),
    ),
    http.put(S3_URL, () => new HttpResponse(null, { status: 403 })),
  );

  const screen = await renderWithProviders(<ImageUploader />);
  await userEvent.upload(screen.getByLabelText(/photos/i), TEST_JPEG);

  await expect
    .element(screen.getByText("Upload failed: 403"))
    .toBeInTheDocument();
});

it("confirmUpload failure shows error message", async () => {
  server.use(
    trpc.image.requestUpload(() =>
      makeRequestUploadResponse({ uploadUrl: S3_URL, s3Key: "key" }),
    ),
    trpc.image.confirmUpload(() => {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    }),
    http.put(S3_URL, () => new HttpResponse(null, { status: 200 })),
  );

  const screen = await renderWithProviders(<ImageUploader />);
  await userEvent.upload(screen.getByLabelText(/photos/i), TEST_JPEG);

  await expect
    .element(screen.getByText("Failed to confirm upload"))
    .toBeInTheDocument();
});

it("PreviewImage: shows skeleton fallback when image fails to load", async () => {
  const BROKEN_URL = "https://cdn.example.com/broken.jpg";
  server.use(
    http.get(BROKEN_URL, () => new HttpResponse(null, { status: 500 })),
  );

  const { PreviewImage } = exportedForTesting;
  const screen = await renderWithProviders(
    <PreviewImage url={BROKEN_URL} name="test.jpg" />,
  );

  await expect
    .element(screen.getByTestId("preview-fallback"))
    .toBeInTheDocument();
});
