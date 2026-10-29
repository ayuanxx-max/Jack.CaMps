// Cross-platform manifest sanity check, run by CI on Linux, macOS and Windows.
// Fails on Windows-only assumptions (CRLF text, bad casing, missing files) so a
// Linux checkout cannot silently break.
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const fail = [];
const ok = [];
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const exists = (rel) => fs.existsSync(path.join(root, rel));

const pkg = JSON.parse(read('package.json'));

// 1. Package identity (marketplaces require kebab-case).
if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(pkg.name)) fail.push(`package name is not kebab-case: ${pkg.name}`);
else ok.push(`name ${pkg.name}`);

if (!/^\d+\.\d+\.\d+$/.test(pkg.version)) fail.push(`version is not semver: ${pkg.version}`);
else ok.push(`version ${pkg.version}`);

// 2. Declared files must exist with exact casing (Linux is case-sensitive).
for (const rel of pkg.files || []) {
  const hit = fs.existsSync(path.join(root, rel));
  if (!hit) fail.push(`files[] entry missing: ${rel}`);
}
ok.push(`files[] entries ${pkg.files.length}`);

// 3. Entry points resolve.
const exportsMap = pkg.exports || {};
for (const [key, target] of Object.entries(exportsMap)) {
  const rel = String(target).replace(/^\.\//, '');
  if (!exists(rel)) fail.push(`export "${key}" points at a missing file: ${rel}`);
}
if (!exportsMap['./client']) fail.push('missing "./client" export (the dsh client half)');
else ok.push('client export');

// 4. dsh bundle + client manifest.
const patch = pkg.dsh?.bundle?.patch;
if (!patch) fail.push('dsh.bundle.patch is not declared');
else if (!exists(patch)) fail.push(`dsh.bundle.patch points at a missing file: ${patch}`);
else ok.push(`bundle patch ${patch}`);

if (pkg.dsh?.client?.platform !== 'web') fail.push('dsh.client.platform must be "web"');
else ok.push('client platform web');

// 5. Text files must be LF + BOM-free so a Linux checkout and the npm tarball
//    behave the same as the Windows worktree.
const textFiles = ['client.js', 'index.js', 'cordis.patch.yml', 'package.json', 'README.md', 'LICENSE', 'scripts/install.sh'];
for (const rel of textFiles) {
  if (!exists(rel)) continue;
  const buf = fs.readFileSync(path.join(root, rel));
  if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) fail.push(`BOM found: ${rel}`);
  const crlf = buf.indexOf(Buffer.from('\r\n'));
  if (crlf !== -1 && !rel.endsWith('.ps1')) fail.push(`CRLF found in ${rel} (expected LF)`);
}
ok.push(`checked ${textFiles.length} text files for BOM/CRLF`);

// 6. No Windows-absolute paths leaked into machine-readable files.
for (const rel of ['package.json', 'cordis.patch.yml', 'client.js', 'index.js']) {
  if (!exists(rel)) continue;
  if (/[A-Za-z]:\\\\|[A-Za-z]:\\/.test(read(rel))) fail.push(`Windows absolute path in ${rel}`);
}
ok.push('no Windows absolute paths');

// 7. POSIX installer must exist and use an absolute symlink target variable.
const sh = exists('scripts/install.sh') ? read('scripts/install.sh') : '';
if (!sh) fail.push('scripts/install.sh is missing');
else if (!sh.includes('ln -sfn')) fail.push('scripts/install.sh does not create a symlink');
else ok.push('posix installer present');

for (const line of ok) console.log(`ok   ${line}`);
for (const line of fail) console.error(`FAIL ${line}`);
if (fail.length) {
  console.error(`\n${fail.length} problem(s)`);
  process.exit(1);
}
console.log('\nmanifest OK');
