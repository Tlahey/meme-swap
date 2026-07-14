import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';

import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';

import { buildArgs, getPythonPath, getFaceFusionDir, FaceswapOptions } from './index';

describe('buildArgs', () => {
  const baseOptions: FaceswapOptions = {
    sourcePath: 'source.jpg',
    targetPath: 'target.mp4',
    outputPath: 'output.mp4',
  };

  beforeEach(() => {
    // buildArgs mkdir's the FaceFusion temp dir as a side effect; pretend it
    // already exists so tests don't touch the real filesystem.
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'mkdirSync').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('always starts with the headless-run subcommand', () => {
    const args = buildArgs(baseOptions);
    expect(args[0]).toBe('headless-run');
  });

  it('resolves the required source/target/output paths to absolute paths', () => {
    const args = buildArgs(baseOptions);
    expect(args[args.indexOf('-s') + 1]).toBe(path.resolve('source.jpg'));
    expect(args[args.indexOf('-t') + 1]).toBe(path.resolve('target.mp4'));
    expect(args[args.indexOf('-o') + 1]).toBe(path.resolve('output.mp4'));
  });

  it('defaults execution providers to coreml and cpu when not specified', () => {
    const args = buildArgs(baseOptions);
    const idx = args.indexOf('--execution-providers');
    expect(args.slice(idx + 1, idx + 3)).toEqual(['coreml', 'cpu']);
  });

  it('uses custom execution providers when specified', () => {
    const args = buildArgs({ ...baseOptions, executionProviders: ['cuda'] });
    const idx = args.indexOf('--execution-providers');
    expect(args[idx + 1]).toBe('cuda');
  });

  it('omits every optional flag when the matching option is not set', () => {
    const args = buildArgs(baseOptions);
    expect(args).not.toContain('--face-selector-mode');
    expect(args).not.toContain('--execution-thread-count');
    expect(args).not.toContain('--log-level');
    expect(args).not.toContain('--keep-temp');
    expect(args).not.toContain('--processors');
    expect(args).not.toContain('--face-mask-blur');
    expect(args).not.toContain('--face-enhancer-blend');
  });

  it('adds face_enhancer to --processors and a --face-enhancer-model flag when faceEnhancerModel is set', () => {
    const args = buildArgs({ ...baseOptions, faceEnhancerModel: 'codeformer' });
    const procIdx = args.indexOf('--processors');
    expect(procIdx).toBeGreaterThan(-1);
    expect(args[procIdx + 1]).toBe('face_enhancer');
    expect(args[args.indexOf('--face-enhancer-model') + 1]).toBe('codeformer');
  });

  it('rounds faceEnhancerBlend to the nearest integer for --face-enhancer-blend', () => {
    const args = buildArgs({ ...baseOptions, faceEnhancerBlend: 79.6 });
    expect(args[args.indexOf('--face-enhancer-blend') + 1]).toBe('80');
  });

  it('emits --face-enhancer-blend even without faceEnhancerModel set (independent flags)', () => {
    const args = buildArgs({ ...baseOptions, faceEnhancerBlend: 50 });
    expect(args).not.toContain('--processors');
    expect(args[args.indexOf('--face-enhancer-blend') + 1]).toBe('50');
  });

  it('changes the -s args pairing to include the target path when lipSyncerModel is set', () => {
    const args = buildArgs({ ...baseOptions, lipSyncerModel: 'wav2lip' });
    const sIdx = args.indexOf('-s');
    expect(args[sIdx + 1]).toBe(path.resolve(baseOptions.sourcePath));
    expect(args[sIdx + 2]).toBe(path.resolve(baseOptions.targetPath));
    expect(args[args.indexOf('--processors') + 1]).toBe('lip_syncer');
    expect(args[args.indexOf('--lip-syncer-model') + 1]).toBe('wav2lip');
  });

  it('only passes the source path after -s when lipSyncerModel is not set', () => {
    const args = buildArgs(baseOptions);
    const sIdx = args.indexOf('-s');
    expect(args[sIdx + 1]).toBe(path.resolve(baseOptions.sourcePath));
    expect(args[sIdx + 2]).toBe('-t');
  });

  it('divides faceMaskBlend by 100 for --face-mask-blur', () => {
    const args = buildArgs({ ...baseOptions, faceMaskBlend: 70 });
    expect(args[args.indexOf('--face-mask-blur') + 1]).toBe('0.7');
  });

  it('combines multiple processors in swapper/enhancer/frame/lip/expression order', () => {
    const args = buildArgs({
      ...baseOptions,
      faceSwapperModel: 'inswapper_128',
      faceEnhancerModel: 'codeformer',
      frameEnhancerModel: 'real_esrgan_x2',
      lipSyncerModel: 'wav2lip',
      expressionRestorerModel: 'live_portrait',
    });
    const procIdx = args.indexOf('--processors');
    expect(args.slice(procIdx + 1, procIdx + 6)).toEqual([
      'face_swapper',
      'face_enhancer',
      'frame_enhancer',
      'lip_syncer',
      'expression_restorer',
    ]);
  });

  it('adds --keep-temp only when keepTemp is true', () => {
    expect(buildArgs(baseOptions)).not.toContain('--keep-temp');
    expect(buildArgs({ ...baseOptions, keepTemp: true })).toContain('--keep-temp');
  });

  it('adds --face-selector-mode, --execution-thread-count and --log-level when provided', () => {
    const args = buildArgs({
      ...baseOptions,
      faceSelectorMode: 'one',
      threadCount: 8,
      logLevel: 'debug',
    });
    expect(args[args.indexOf('--face-selector-mode') + 1]).toBe('one');
    expect(args[args.indexOf('--execution-thread-count') + 1]).toBe('8');
    expect(args[args.indexOf('--log-level') + 1]).toBe('debug');
  });

  it('always appends --temp-path pointing at ~/.meme-swap/process/temp/facefusion-temp', () => {
    const args = buildArgs(baseOptions);
    const tempIdx = args.indexOf('--temp-path');
    expect(tempIdx).toBeGreaterThan(-1);
    expect(args[tempIdx + 1]).toBe(
      path.join(os.homedir(), '.meme-swap', 'process', 'temp', 'facefusion-temp'),
    );
  });
});

describe('getPythonPath', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('prefers python3.11 when it exists in the venv', () => {
    vi.spyOn(fs, 'existsSync').mockImplementation((p) => String(p).endsWith('python3.11'));
    expect(getPythonPath()).toBe(path.join(getFaceFusionDir(), 'venv', 'bin', 'python3.11'));
  });

  it('falls back to python3 when python3.11 is absent but python3 exists', () => {
    vi.spyOn(fs, 'existsSync').mockImplementation((p) => String(p).endsWith('python3'));
    expect(getPythonPath()).toBe(path.join(getFaceFusionDir(), 'venv', 'bin', 'python3'));
  });

  it('falls back to plain python when neither python3.11 nor python3 exist', () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(false);
    expect(getPythonPath()).toBe(path.join(getFaceFusionDir(), 'venv', 'bin', 'python'));
  });
});
