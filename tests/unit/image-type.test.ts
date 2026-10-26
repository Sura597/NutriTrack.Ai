import { describe, it, expect } from "vitest";
import { detectImageType } from "@/lib/image-type";

const bytes = (...n: number[]) => new Uint8Array(n);

describe("detectImageType (trusts bytes, not the client's content-type)", () => {
  it("recognises JPEG, PNG and WebP", () => {
    expect(detectImageType(bytes(0xff, 0xd8, 0xff, 0xe0, 0, 0))).toEqual({ mime: "image/jpeg", ext: "jpg" });
    expect(detectImageType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0))).toEqual({ mime: "image/png", ext: "png" });
    expect(detectImageType(bytes(0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50))).toEqual({ mime: "image/webp", ext: "webp" });
  });
  it("rejects other formats and disguised files", () => {
    expect(detectImageType(new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'></svg>"))).toBeNull();
    expect(detectImageType(new TextEncoder().encode("GIF89a......"))).toBeNull();
    expect(detectImageType(new TextEncoder().encode("#!/bin/sh\nrm -rf /"))).toBeNull();
    expect(detectImageType(bytes(0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x41, 0x56, 0x45))).toBeNull(); // RIFF/WAVE
    expect(detectImageType(bytes())).toBeNull();
    expect(detectImageType(bytes(0xff, 0xd8))).toBeNull(); // truncated
  });
});
