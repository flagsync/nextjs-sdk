import replaceInFile from 'replace-in-file';
import semver from 'semver';
import { type Options, defineConfig } from 'tsup';

import packageJson from './package.json';

async function injectSdkDetails(dist: string) {
  const anticipatedVersion = getAnticipatedVersion();

  console.log(`[build] anticipated version tag: ${anticipatedVersion}`);

  try {
    await replaceInFile({
      files: `${dist}/**/*`,
      from: /__SDK_NAME__/g,
      to: packageJson.name,
    });
    await replaceInFile({
      files: `${dist}/**/*`,
      from: /__SDK_VERSION__/g,
      to: anticipatedVersion,
    });
  } catch (error) {
    console.error('[injectSdkDetails]:', error);
  }
}

function getAnticipatedVersion(): string {
  const current = packageJson.version;

  console.log(`[build] current version tag: ${current}`);

  if (process.env.MINOR === 'true') {
    console.log(`[build] bumping minor`);
    return semver.inc(current, 'minor')!;
  }
  if (process.env.PATCH === 'true') {
    console.log(`[build] bumping patch`);
    return semver.inc(current, 'patch')!;
  }
  if (process.env.PRERELEASE === 'true') {
    console.log(`[build] bumping prerelease`);
    return semver.inc(current, 'prerelease', 'alpha')!;
  }

  console.log(`[build] no env release type found, skipping bump`);
  return current;
}

export function config(opts: Options): Options {
  return {
    entry: opts.entry,
    format: ['cjs', 'esm'],
    target: ['node16'], // Only targeting Node.js 16+
    outDir: 'dist',
    dts: true,
    sourcemap: true,
    clean: true,
    async onSuccess() {
      await injectSdkDetails('dist');
    },
  };
}

export default defineConfig([config({ entry: ['src/index.ts'] })]);
