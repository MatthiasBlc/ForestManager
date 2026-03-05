import { describe, it, expect, vi, beforeEach } from "vitest";

// vi.hoisted pour que les mocks soient accessibles dans vi.mock (hoiste)
const { mockSend, mockGetSignedUrl } = vi.hoisted(() => ({
  mockSend: vi.fn(),
  mockGetSignedUrl: vi.fn(),
}));

vi.mock("@aws-sdk/client-s3", () => {
  return {
    S3Client: vi.fn().mockImplementation(() => ({ send: mockSend })),
    PutObjectCommand: vi.fn().mockImplementation((input) => ({ input })),
    DeleteObjectCommand: vi.fn().mockImplementation((input) => ({ input })),
    HeadObjectCommand: vi.fn().mockImplementation((input) => ({ input })),
  };
});

vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: (...args: unknown[]) => mockGetSignedUrl(...args),
}));

vi.mock("../../config/storage", () => ({
  storageConfig: {
    endpoint: "localhost",
    port: 9000,
    accessKey: "minioadmin",
    secretKey: "minioadmin",
    bucket: "test-bucket",
    publicUrl: "http://localhost:9000",
    useSSL: false,
    presignedUrlTTL: 60,
    maxFileSize: 2 * 1024 * 1024,
    allowedMimeTypes: ["image/webp", "image/jpeg", "image/png"],
  },
}));

vi.mock("../../util/logger", () => ({
  default: {
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

import {
  generatePresignedUploadUrl,
  headObject,
  deleteObject,
  validateUploadedFile,
} from "../../services/storageService";

describe("storageService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("generatePresignedUploadUrl", () => {
    it("should return a presigned URL", async () => {
      mockGetSignedUrl.mockResolvedValue("https://minio.test/presigned-url");

      const url = await generatePresignedUploadUrl("recipes/abc/cover.webp");

      expect(url).toBe("https://minio.test/presigned-url");
      expect(mockGetSignedUrl).toHaveBeenCalledOnce();
    });
  });

  describe("headObject", () => {
    it("should return content type and length", async () => {
      mockSend.mockResolvedValue({
        ContentType: "image/webp",
        ContentLength: 50000,
      });

      const result = await headObject("recipes/abc/cover.webp");

      expect(result).toEqual({
        contentType: "image/webp",
        contentLength: 50000,
      });
    });

    it("should return null for NotFound", async () => {
      const notFoundError = new Error("NotFound");
      notFoundError.name = "NotFound";
      mockSend.mockRejectedValue(notFoundError);

      const result = await headObject("nonexistent.webp");
      expect(result).toBeNull();
    });

    it("should throw for other errors", async () => {
      mockSend.mockRejectedValue(new Error("NetworkError"));

      await expect(headObject("key")).rejects.toThrow("NetworkError");
    });

    it("should default contentType and contentLength when missing", async () => {
      mockSend.mockResolvedValue({});

      const result = await headObject("key");
      expect(result).toEqual({
        contentType: "unknown",
        contentLength: 0,
      });
    });
  });

  describe("deleteObject", () => {
    it("should call S3 send with delete command", async () => {
      mockSend.mockResolvedValue({});

      await deleteObject("recipes/abc/cover.webp");

      expect(mockSend).toHaveBeenCalledOnce();
    });
  });

  describe("validateUploadedFile", () => {
    it("should return null for valid file", async () => {
      mockSend.mockResolvedValue({
        ContentType: "image/webp",
        ContentLength: 100000,
      });

      const error = await validateUploadedFile("key");
      expect(error).toBeNull();
    });

    it("should return error when file not found", async () => {
      const notFoundError = new Error("NotFound");
      notFoundError.name = "NotFound";
      mockSend.mockRejectedValue(notFoundError);

      const error = await validateUploadedFile("key");
      expect(error).toBe("File not found on storage");
    });

    it("should return error for invalid MIME type", async () => {
      mockSend.mockResolvedValue({
        ContentType: "application/pdf",
        ContentLength: 100000,
      });

      const error = await validateUploadedFile("key");
      expect(error).toContain("Invalid file type");
    });

    it("should return error for file too large", async () => {
      mockSend.mockResolvedValue({
        ContentType: "image/webp",
        ContentLength: 5 * 1024 * 1024, // 5 MB
      });

      const error = await validateUploadedFile("key");
      expect(error).toContain("File too large");
    });
  });
});
