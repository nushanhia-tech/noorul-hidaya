/** Server-side file validation: size, declared type AND magic bytes. */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export const DOCUMENT_TYPES = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
} as const;
export const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;

export type AllowedMime = keyof typeof DOCUMENT_TYPES;

export function sniffMime(bytes: Uint8Array): AllowedMime | null {
  const b = bytes;
  if (b.length >= 5 && b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46 && b[4] === 0x2d) return "application/pdf";
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length >= 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return "image/webp";
  if (b.length >= 4 && b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04) {
    // DOCX is a ZIP; require the word/ part to appear in the central directory
    const text = new TextDecoder("latin1").decode(b);
    if (text.includes("word/") || text.includes("[Content_Types].xml")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  return null;
}

export type UploadCheck =
  | { ok: true; mime: AllowedMime; ext: string; safeName: string }
  | { ok: false; error: string };

export function checkUpload(
  file: { name: string; size: number; type: string },
  head: Uint8Array,
  opts: { allowed?: readonly string[]; maxBytes?: number } = {},
): UploadCheck {
  const allowed = opts.allowed ?? Object.keys(DOCUMENT_TYPES);
  const max = opts.maxBytes ?? MAX_UPLOAD_BYTES;
  if (!file || file.size === 0) return { ok: false, error: "Choose a file to upload." };
  if (file.size > max) return { ok: false, error: `File is too large. The limit is ${Math.round(max / 1024 / 1024)} MB.` };
  const sniffed = sniffMime(head);
  if (!sniffed || !allowed.includes(sniffed)) return { ok: false, error: "Unsupported file type. Upload a PDF, DOCX, PNG, JPG or WEBP file." };
  if (file.type && file.type !== sniffed && !(file.type === "application/octet-stream")) {
    return { ok: false, error: "The file's contents do not match its type." };
  }
  return { ok: true, mime: sniffed, ext: DOCUMENT_TYPES[sniffed], safeName: safeFileName(file.name, DOCUMENT_TYPES[sniffed]) };
}

export function safeFileName(name: string, ext: string) {
  const base = name.replace(/\.[^.]+$/, "").normalize("NFKD").replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-").slice(0, 80) || "document";
  return `${base}.${ext}`;
}

export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
