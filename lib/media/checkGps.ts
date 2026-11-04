/**
 * Checks whether a JPEG, WebP, or PNG image buffer contains GPS location data.
 * Returns true if GPS IFD is found (upload must be refused, AC6).
 *
 * Strategy:
 * - JPEG: scan APP1 (0xFFE1) markers for EXIF header, then walk IFD0 looking
 *   for tag 0x8825 (GPS IFD pointer). If found → GPS present.
 * - WebP: scan EXIF chunk ("EXIF" fourcc in RIFF), then same EXIF walk.
 * - PNG: scan for eXIf chunk (PNG 1.6 standard) and iTXt/zTXt chunks with
 *   "GPS" in their keyword; also checks tEXt GPS keywords.
 * - Any parse error → return false (safe: GPS presence not proved).
 *
 * This is intentionally minimal — no full EXIF library — to avoid adding a
 * heavy dependency for a single security check.
 */
export function checkGps(bytes: Uint8Array): boolean {
  if (bytes.length < 12) return false;

  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    return _jpegHasGps(bytes);
  }

  // WebP: RIFF....WEBP
  if (
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) {
    return _webpHasGps(bytes);
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) {
    return _pngHasGps(bytes);
  }

  return false;
}

// ---------------------------------------------------------------------------
// JPEG helpers
// ---------------------------------------------------------------------------

function _jpegHasGps(buf: Uint8Array): boolean {
  let pos = 2; // skip SOI marker
  while (pos + 3 < buf.length) {
    if (buf[pos] !== 0xff) break;
    const marker = buf[pos + 1]!;
    if (marker === 0xe1) {
      // APP1 — may contain EXIF
      const len = _u16be(buf, pos + 2);
      if (len < 2) break;
      const app1End = pos + 2 + len;
      const data = buf.subarray(pos + 4, Math.min(app1End, buf.length));
      if (_isExif(data) && _exifHasGps(data, 6)) return true;
      pos = app1End;
    } else if (marker === 0xda) {
      break; // SOS — image data starts, no more metadata
    } else {
      const len = _u16be(buf, pos + 2);
      if (len < 2) break;
      pos += 2 + len;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// WebP helpers
// ---------------------------------------------------------------------------

function _webpHasGps(buf: Uint8Array): boolean {
  let pos = 12; // past RIFF header + WEBP
  while (pos + 8 <= buf.length) {
    const fourcc = String.fromCharCode(buf[pos]!, buf[pos+1]!, buf[pos+2]!, buf[pos+3]!);
    const chunkLen = _u32le(buf, pos + 4);
    if (fourcc === "EXIF") {
      const data = buf.subarray(pos + 8, pos + 8 + chunkLen);
      // EXIF chunk may start with "Exif\0\0" or directly with II/MM
      const offset = _isExif(data) ? 6 : 0;
      if (_exifHasGps(data, offset)) return true;
    }
    pos += 8 + chunkLen + (chunkLen % 2); // chunks are padded to even
  }
  return false;
}

// ---------------------------------------------------------------------------
// EXIF IFD walker
// ---------------------------------------------------------------------------

function _isExif(data: Uint8Array): boolean {
  // "Exif\0\0"
  return data.length >= 6 &&
    data[0] === 0x45 && data[1] === 0x78 && data[2] === 0x69 &&
    data[3] === 0x66 && data[4] === 0x00 && data[5] === 0x00;
}

function _exifHasGps(data: Uint8Array, tiffOffset: number): boolean {
  if (data.length < tiffOffset + 8) return false;
  const tiff = data.subarray(tiffOffset);
  if (tiff.length < 8) return false;

  // Byte order: II = little-endian, MM = big-endian
  const isLE = tiff[0] === 0x49 && tiff[1] === 0x49;
  const isBE = tiff[0] === 0x4d && tiff[1] === 0x4d;
  if (!isLE && !isBE) return false;

  const u16 = (off: number) => isLE ? _u16le(tiff, off) : _u16be(tiff, off);
  const u32 = (off: number) => isLE ? _u32le(tiff, off) : _u32be(tiff, off);

  // IFD0 offset
  const ifd0 = u32(4);
  if (ifd0 + 2 > tiff.length) return false;
  const entryCount = u16(ifd0);
  for (let i = 0; i < entryCount; i++) {
    const entryOff = ifd0 + 2 + i * 12;
    if (entryOff + 12 > tiff.length) break;
    const tag = u16(entryOff);
    if (tag === 0x8825) return true; // GPS IFD pointer
  }
  return false;
}

// ---------------------------------------------------------------------------
// PNG helpers
// ---------------------------------------------------------------------------

function _pngHasGps(buf: Uint8Array): boolean {
  let pos = 8; // past PNG signature
  while (pos + 12 <= buf.length) {
    const len = _u32be(buf, pos);
    const type = String.fromCharCode(buf[pos+4]!, buf[pos+5]!, buf[pos+6]!, buf[pos+7]!);

    // eXIf chunk (PNG 1.6): contains a standard TIFF/EXIF block
    if (type === "eXIf") {
      const data = buf.subarray(pos + 8, pos + 8 + len);
      if (_exifHasGps(data, 0)) return true;
    }

    // tEXt / iTXt / zTXt: check keyword for "GPS" (case-insensitive)
    if (type === "tEXt" || type === "iTXt" || type === "zTXt") {
      const chunk = buf.subarray(pos + 8, pos + 8 + Math.min(len, 32));
      // keyword is a null-terminated ASCII string at the start of the chunk
      let kwEnd = 0;
      while (kwEnd < chunk.length && chunk[kwEnd] !== 0) kwEnd++;
      const kw = String.fromCharCode(...chunk.subarray(0, kwEnd)).toLowerCase();
      if (kw.includes("gps")) return true;
    }

    pos += 8 + len + 4; // length(4) + type(4) + data(len) + crc(4)
  }
  return false;
}

// ---------------------------------------------------------------------------
// Byte helpers
// ---------------------------------------------------------------------------

function _u16be(b: Uint8Array, o: number): number { return ((b[o]! << 8) | b[o+1]!) >>> 0; }
function _u16le(b: Uint8Array, o: number): number { return ((b[o+1]! << 8) | b[o]!) >>> 0; }
function _u32be(b: Uint8Array, o: number): number {
  return (((b[o]! << 24) | (b[o+1]! << 16) | (b[o+2]! << 8) | b[o+3]!) >>> 0);
}
function _u32le(b: Uint8Array, o: number): number {
  return (((b[o+3]! << 24) | (b[o+2]! << 16) | (b[o+1]! << 8) | b[o]!) >>> 0);
}
