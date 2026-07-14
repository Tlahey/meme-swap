import { describe, it, expect } from 'vitest';

import { isMissingBinaryError, classifyFfmpegSpawnError, classifyFfmpegExit } from './index';

describe('isMissingBinaryError', () => {
  it('returns true for a Node ENOENT spawn error (binary not on PATH)', () => {
    const err = new Error('spawn ffmpeg ENOENT');
    expect(isMissingBinaryError(err)).toBe(true);
  });

  it('returns true for a shell "command not found" style message', () => {
    const err = new Error('/bin/sh: ffmpeg: not found');
    expect(isMissingBinaryError(err)).toBe(true);
  });

  it('returns false for an unrelated spawn error (e.g. permission denied)', () => {
    const err = new Error('spawn ffmpeg EACCES');
    expect(isMissingBinaryError(err)).toBe(false);
  });
});

describe('classifyFfmpegSpawnError', () => {
  it('classifies an ENOENT spawn error as missing-install with an install hint', () => {
    const result = classifyFfmpegSpawnError(new Error('spawn ffmpeg ENOENT'));
    expect(result.errorCode).toBe('missing-install');
    expect(result.error).toContain('FFmpeg is not installed');
    expect(result.error).toContain('brew install ffmpeg');
  });

  it('classifies a non-ENOENT spawn error as broken-install and includes the raw message', () => {
    const result = classifyFfmpegSpawnError(new Error('spawn ffmpeg EACCES'));
    expect(result.errorCode).toBe('broken-install');
    expect(result.error).toContain('FFmpeg failed to start');
    expect(result.error).toContain('spawn ffmpeg EACCES');
    expect(result.error).toContain('brew reinstall ffmpeg');
  });
});

describe('classifyFfmpegExit', () => {
  it('classifies a dyld library-load failure in stderr as broken-install', () => {
    const stderr =
      'dyld: Library not loaded: /usr/local/opt/x264/lib/libx264.164.dylib\n' +
      'Referenced from: /opt/homebrew/bin/ffmpeg';
    const result = classifyFfmpegExit(134, stderr, 'converting GIF to MP4');
    expect(result.errorCode).toBe('broken-install');
    expect(result.error).toContain('converting GIF to MP4');
    expect(result.error).toContain('134');
    expect(result.error).toContain('brew reinstall ffmpeg');
    expect(result.error).toContain(stderr);
  });

  it('classifies an "image not found" stderr snippet as broken-install too', () => {
    const stderr = 'dyld: Symbol not found\n  Expected in: image not found';
    const result = classifyFfmpegExit(1, stderr, 'generating the color palette');
    expect(result.errorCode).toBe('broken-install');
  });

  it('treats a generic encoding failure (no dyld/library markers) as an ordinary error, not an install problem', () => {
    const stderr = 'Unknown encoder "libx264_bogus"';
    const result = classifyFfmpegExit(1, stderr, 'converting MP4 to GIF');
    expect(result.errorCode).toBeUndefined();
    expect(result.error).toBe(stderr);
  });

  it('falls back to a generic "exited with code" message when stderr is empty', () => {
    const result = classifyFfmpegExit(1, '', 'converting GIF to MP4');
    expect(result.errorCode).toBeUndefined();
    expect(result.error).toBe('FFmpeg exited with code 1');
  });
});
