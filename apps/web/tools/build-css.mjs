/** Pinned Tailwind core compiler, literal source tokens only; see ADR 0025. */
import {compile} from 'tailwindcss';
import {createRequire} from 'node:module';
import {readFile, readdir, mkdir, writeFile} from 'node:fs/promises';
import {dirname, join, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';

const require = createRequire(import.meta.url);
const packageRoot = dirname(require.resolve('tailwindcss/package.json'));
const root = fileURLToPath(new URL('..', import.meta.url));

export async function buildStyles(source) {
  const compiler = await compile('@import "tailwindcss";', {
    base: packageRoot,
    loadStylesheet: async (id, base) => {
      const path = id === 'tailwindcss' ? join(packageRoot, 'index.css') : resolve(base, id);
      if (!path.startsWith(packageRoot + sep) || !path.endsWith('.css')) throw Error('Non-local stylesheet refused');
      return {path, base: dirname(path), content: await readFile(path, 'utf8')};
    },
  });
  const candidates = [...new Set(source.match(/[a-zA-Z0-9_:.!#%/()[\]-]+/g) || [])];
  return compiler.build(candidates);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  async function collect(directory) {
    const paths = [];
    for (const entry of await readdir(directory, {withFileTypes: true})) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) paths.push(...await collect(path));
      else if (entry.isFile() && /\.tsx?$/.test(entry.name)) paths.push(path);
    }
    return paths;
  }
  const paths = await collect(join(root, 'src'));
  paths.push(join(root, 'index.html'));
  const source = (await Promise.all(paths.map(path => readFile(path, 'utf8')))).join('\n');
  await mkdir(join(root, 'build'), {recursive:true});
  await writeFile(join(root, 'build/styles.css'), await buildStyles(source));
}
