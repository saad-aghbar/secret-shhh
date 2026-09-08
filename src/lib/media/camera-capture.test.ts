import { describe, expect, it } from "vitest";

import {
  captureCameraStill,
  takePhotoViaImageCapture,
  toCameraPhotoFile,
} from "@/lib/media/camera-capture";

function jpegBlob() {
  return new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], { type: "image/jpeg" });
}

describe("takePhotoViaImageCapture", () => {
  it("returns the still when MIME is allowed", async () => {
    const still = jpegBlob();
    await expect(takePhotoViaImageCapture(async () => still)).resolves.toBe(still);
  });

  it("returns null for unsupported types", async () => {
    const still = new Blob([new Uint8Array([1])], { type: "image/bmp" });
    await expect(takePhotoViaImageCapture(async () => still)).resolves.toBeNull();
  });

  it("returns null when takePhoto rejects", async () => {
    await expect(
      takePhotoViaImageCapture(async () => {
        throw new Error("nope");
      }),
    ).resolves.toBeNull();
  });
});

describe("captureCameraStill", () => {
  const video = { videoWidth: 8, videoHeight: 6 } as HTMLVideoElement;
  const track = {} as MediaStreamTrack;

  it("prefers ImageCapture when it yields an allowed still", async () => {
    const still = jpegBlob();
    class FakeCapture {
      takePhoto() {
        return Promise.resolve(still);
      }
    }
    const file = await captureCameraStill({
      video,
      track,
      ImageCaptureImpl: FakeCapture,
      now: 42,
    });
    expect(file.type).toBe("image/jpeg");
    expect(file.name).toBe("shhh-42.jpg");
  });

  it("falls back to canvas when ImageCapture is missing", async () => {
    const jpeg = jpegBlob();
    const canvas = {
      width: 0,
      height: 0,
      getContext() {
        return {
          drawImage() {
            /* draw */
          },
        };
      },
    } as unknown as HTMLCanvasElement;
    const file = await captureCameraStill({
      video,
      track,
      ImageCaptureImpl: false,
      canvas,
      now: 99,
      encodeJpeg: async () => jpeg,
    });
    expect(file.name).toBe("shhh-99.jpg");
    expect(file.type).toBe("image/jpeg");
  });

  it("falls back to canvas when ImageCapture returns an unsupported type", async () => {
    class FakeCapture {
      takePhoto() {
        return Promise.resolve(new Blob([new Uint8Array([1])], { type: "image/bmp" }));
      }
    }
    const jpeg = jpegBlob();
    const canvas = {
      width: 0,
      height: 0,
      getContext() {
        return { drawImage() {} };
      },
    } as unknown as HTMLCanvasElement;
    const file = await captureCameraStill({
      video,
      track,
      ImageCaptureImpl: FakeCapture,
      canvas,
      encodeJpeg: async () => jpeg,
      now: 7,
    });
    expect(file.name).toBe("shhh-7.jpg");
  });
});

describe("toCameraPhotoFile", () => {
  it("names png stills with a png extension", () => {
    const file = toCameraPhotoFile(
      new Blob([new Uint8Array([1])], { type: "image/png" }),
      "image/png",
      5,
    );
    expect(file.name).toBe("shhh-5.png");
  });
});
