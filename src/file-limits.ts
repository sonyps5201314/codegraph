import * as fs from 'fs';
import * as fsp from 'fs/promises';

/**
 * Default largest source file CodeGraph will parse or read during resolution.
 * 10 MB covers essentially all hand-written source. Can be customized via
 * the CODEGRAPH_MAX_FILE_SIZE environment variable (e.g. "20MB", "5242880").
 */
export const DEFAULT_MAX_FILE_SIZE = 10 * 1024 * 1024;

export function parseMaxFileSize(val: string | undefined): number {
  if (!val) return DEFAULT_MAX_FILE_SIZE;
  const trimmed = val.trim().toUpperCase();
  if (trimmed.endsWith('MB') || trimmed.endsWith('M')) {
    const num = parseFloat(trimmed);
    if (!isNaN(num) && num > 0) return Math.floor(num * 1024 * 1024);
  }
  if (trimmed.endsWith('KB') || trimmed.endsWith('K')) {
    const num = parseFloat(trimmed);
    if (!isNaN(num) && num > 0) return Math.floor(num * 1024);
  }
  const bytes = parseInt(trimmed, 10);
  if (!isNaN(bytes) && bytes > 0) return bytes;
  return DEFAULT_MAX_FILE_SIZE;
}

export function getMaxFileSize(): number {
  return parseMaxFileSize(process.env.CODEGRAPH_MAX_FILE_SIZE);
}

export const MAX_SOURCE_FILE_SIZE_BYTES = DEFAULT_MAX_FILE_SIZE;

/**
 * What stands in for the content of a file over MAX_SOURCE_FILE_SIZE_BYTES. Such a file is
 * never parsed, so its bytes are never needed — reading them only to hash and
 * discard cost multi-GB RSS spikes on committed video/blob fixtures and could
 * fail outright with `Invalid string length` (#1910). The stamp is a function
 * of size alone: change detection compares it to the stored hash, so a
 * same-size rewrite of an oversize file is not a change (nothing about it is
 * indexed), while crossing the limit in either direction is.
 */
export function oversizeStamp(size: number): string {
  return `codegraph:oversize:${size}`;
}

/**
 * The text whose hash the index stores for a file of `size` bytes: its content
 * within the limit, the size stamp over it. Anything that checks a file on disk
 * against its stored `contentHash` has to hash this, or every unchanged file
 * over the limit reads as drifted. `content` is only read within the limit.
 */
export function indexedHashInput(size: number, content: () => string): string {
  const limit = getMaxFileSize();
  return size > limit ? oversizeStamp(size) : content();
}

/**
 * A source file's text, or null for what extraction wouldn't take: anything but
 * a regular file, or a file over the limit, which decoding could multiply into
 * gigabytes of heap. Checked on the open file: looking the path up twice is a
 * quarter of the read. O_NONBLOCK keeps a FIFO with no writer from parking the
 * open itself. Throws what a failed open or read throws.
 */
export function readSourceText(file: string, encoding: BufferEncoding = 'utf-8'): string | null {
  const fd = fs.openSync(file, fs.constants.O_RDONLY | (fs.constants.O_NONBLOCK ?? 0));
  try {
    const stats = fs.fstatSync(fd);
    if (!stats.isFile() || stats.size > MAX_SOURCE_FILE_SIZE_BYTES) return null;
    return fs.readFileSync(fd, encoding);
  } finally {
    fs.closeSync(fd);
  }
}

/** A source file's stats, and its bytes when they are within the limit (null = oversize). */
export interface BoundedSource {
  stats: fs.Stats;
  bytes: Buffer | null;
}

const READ_CHUNK_BYTES = 64 * 1024;

function assertRegularFile(stats: fs.Stats): void {
  if (!stats.isFile()) throw new Error('Source path is not a regular file');
}

/**
 * Read a source file without ever holding more than the limit plus one byte.
 * A stat before the read is not enough: the file can grow between the stat
 * and the read (a log, a download, a build output being written), so the
 * descriptor is re-checked after opening and the read itself stops one byte
 * past the limit. Returns `bytes: null` for an oversize file.
 */
export async function readBoundedSource(file: string): Promise<BoundedSource> {
  const limit = getMaxFileSize();
  const initial = await fsp.stat(file);
  assertRegularFile(initial);
  if (initial.size > limit) return { stats: initial, bytes: null };
  const handle = await fsp.open(file, 'r');
  try {
    let stats = await handle.stat();
    assertRegularFile(stats);
    if (stats.size > limit) return { stats, bytes: null };
    const chunks: Buffer[] = [];
    let size = 0;
    while (size <= limit) {
      const chunk = Buffer.allocUnsafe(Math.min(READ_CHUNK_BYTES, limit + 1 - size));
      const { bytesRead } = await handle.read(chunk, 0, chunk.length, size);
      if (!bytesRead) break;
      chunks.push(chunk.subarray(0, bytesRead));
      size += bytesRead;
    }
    stats = await handle.stat();
    if (size > limit || stats.size > limit) {
      stats.size = Math.max(size, stats.size);
      return { stats, bytes: null };
    }
    return { stats, bytes: Buffer.concat(chunks, size) };
  } finally {
    await handle.close();
  }
}

/** Synchronous {@link readBoundedSource}. */
export function readBoundedSourceSync(file: string): BoundedSource {
  const limit = getMaxFileSize();
  const initial = fs.statSync(file);
  assertRegularFile(initial);
  if (initial.size > limit) return { stats: initial, bytes: null };
  const fd = fs.openSync(file, 'r');
  try {
    let stats = fs.fstatSync(fd);
    assertRegularFile(stats);
    if (stats.size > limit) return { stats, bytes: null };
    const chunks: Buffer[] = [];
    let size = 0;
    while (size <= limit) {
      const chunk = Buffer.allocUnsafe(Math.min(READ_CHUNK_BYTES, limit + 1 - size));
      const bytesRead = fs.readSync(fd, chunk, 0, chunk.length, size);
      if (!bytesRead) break;
      chunks.push(chunk.subarray(0, bytesRead));
      size += bytesRead;
    }
    stats = fs.fstatSync(fd);
    if (size > limit || stats.size > limit) {
      stats.size = Math.max(size, stats.size);
      return { stats, bytes: null };
    }
    return { stats, bytes: Buffer.concat(chunks, size) };
  } finally {
    fs.closeSync(fd);
  }
}
