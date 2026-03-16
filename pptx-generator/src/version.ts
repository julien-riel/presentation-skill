import { readFileSync } from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Absolute path to the package root directory. */
export const PACKAGE_ROOT = path.resolve(__dirname, '..');

/** Package version from package.json. */
let _version: string | undefined;
export function getVersion(): string {
  if (!_version) {
    _version = (JSON.parse(readFileSync(path.resolve(PACKAGE_ROOT, 'package.json'), 'utf-8')).version as string | undefined) ?? '0.0.0';
  }
  return _version as string;
}
