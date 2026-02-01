/**
 * Test helpers for loading and working with recording fixtures
 */

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadRecording, type Recording } from '../utils/recording';

/**
 * Get the path to the recordings directory
 * Uses import.meta.url to derive the path from this file's location,
 * making it robust regardless of the current working directory.
 */
function getRecordingsDir(): string {
  // Derive path from this file's location: src/test/helpers.ts -> recordings/
  const __dirname = dirname(fileURLToPath(import.meta.url));
  // Go up two levels (src/test -> src -> project root) then into recordings
  return resolve(__dirname, '..', '..', 'recordings');
}

/**
 * Load a recording fixture by filename
 * 
 * @param filename - Name of the recording file (e.g., 'single-turn-reasoning.jsonl')
 * @returns Parsed recording object
 * @throws Error if file not found or invalid format
 * 
 * @example
 * const recording = loadRecordingFixture('single-turn-reasoning.jsonl');
 * console.log(recording.request.data.model); // 'gpt-5'
 */
export function loadRecordingFixture(filename: string): Recording {
  const recordingsDir = getRecordingsDir();
  const filePath = join(recordingsDir, filename);
  
  try {
    const content = readFileSync(filePath, 'utf-8');
    return loadRecording(content);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(
        `Recording fixture not found: ${filename}\n` +
        `Expected path: ${filePath}\n` +
        `Make sure the file exists in the recordings/ directory.`
      );
    }
    throw err;
  }
}

/**
 * List all available recording fixtures
 * 
 * @returns Array of recording filenames
 */
export function listRecordingFixtures(): string[] {
  const recordingsDir = getRecordingsDir();
  
  try {
    const files = readdirSync(recordingsDir);
    return files.filter((f) => f.endsWith('.jsonl'));
  } catch {
    return [];
  }
}
