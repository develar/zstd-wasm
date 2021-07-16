import { Module } from '../init';
import { isError, getErrorName } from '../errors';

const getFrameContentSize = (buf: ArrayBuffer): number => {
  const getSize = Module.cwrap('ZSTD_getFrameContentSize', 'number', ['array', 'number']);
  return getSize(buf, buf.byteLength);
};

export type DecompressOption = {
  defaultHeapSize?: number;
};

export const decompress = (
  buf: ArrayBuffer,
  opts: DecompressOption = { defaultHeapSize: 1024 * 1024 }, // Use 1MB on default if it is failed to get content size.
): ArrayBuffer => {
  const contentSize = getFrameContentSize(buf);
  const size = contentSize === -1 ? opts.defaultHeapSize : contentSize;
  const malloc = Module.cwrap('malloc', 'number', ['number']);
  const free = Module.cwrap('free', 'number');
  const heap = malloc(size);
  try {
    /*
      @See https://zstd.docsforge.com/dev/api/ZSTD_decompress/
      compressedSize : must be the exact size of some number of compressed and/or skippable frames.
      dstCapacity is an upper bound of originalSize to regenerate.
      If user cannot imply a maximum upper bound, it's better to use streaming mode to decompress data.
      @return: the number of bytes decompressed into dst (<= dstCapacity), or an errorCode if it fails (which can be tested using ZSTD_isError()).
    */
    const _decompress = Module.cwrap('ZSTD_decompress', 'number', ['number', 'number', 'array', 'number']);
    const sizeOrError = _decompress(heap, size, buf, buf.byteLength);
    if (isError(sizeOrError)) {
      throw new Error(getErrorName(sizeOrError));
    }
    // Copy buffer
    // Uint8Array.prototype.slice() return copied buffer.
    const data = new Uint8Array(Module.HEAPU8.buffer, heap, sizeOrError).slice();
    free(heap, size);
    return data;
  } catch (e) {
    free(heap, size);
    throw e;
  }
};