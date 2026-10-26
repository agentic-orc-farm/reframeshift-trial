// The dependency and platform check (UI.md 1 and 4; ADR 0006). Fails if:
// - package.json has any runtime `dependencies`;
// - a framework or CSS framework is among the direct dependencies of any kind;
// - a platform tool (wrangler, miniflare, anything under @cloudflare/) is;
// - a wrangler configuration file is tracked anywhere (or about to be: untracked, not ignored);
// - a workflow references a secret other than CF_ACCESS_CLIENT_ID and CF_ACCESS_CLIENT_SECRET.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';

const FRAMEWORKS = [
  'react', 'react-dom', 'vue', 'svelte', 'preact', 'lit', 'solid-js', 'angular', 'ember-source',
  'next', 'nuxt', 'astro', 'gatsby', 'qwik',
  'tailwindcss', 'bootstrap', 'bulma', 'foundation-sites', 'materialize-css', 'uikit',
];
const FRAMEWORK_SCOPES = ['@angular/', '@sveltejs/', '@vue/', '@remix-run/', '@builder.io/qwik', '@tailwindcss/'];
const PLATFORM_TOOLS = ['wrangler', 'miniflare'];
const PLATFORM_SCOPES = ['@cloudflare/'];
const WRANGLER_FILES = ['wrangler.toml', 'wrangler.json', 'wrangler.jsonc'];
const ALLOWED_SECRETS = new Set(['CF_ACCESS_CLIENT_ID', 'CF_ACCESS_CLIENT_SECRET']);
const DEPENDENCY_FIELDS = ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies'];

const problems = [];
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));

if (Object.keys(pkg.dependencies ?? {}).length > 0) {
  problems.push(
    `package.json has runtime dependencies (${Object.keys(pkg.dependencies).join(', ')}); ` +
      'the site has none, and tooling belongs in devDependencies.',
  );
}

for (const field of DEPENDENCY_FIELDS) {
  for (const name of Object.keys(pkg[field] ?? {})) {
    if (FRAMEWORKS.includes(name) || FRAMEWORK_SCOPES.some((s) => name.startsWith(s))) {
      problems.push(`${field} names a framework or CSS framework: ${name} (UI.md 1: no framework).`);
    }
    if (PLATFORM_TOOLS.includes(name) || PLATFORM_SCOPES.some((s) => name.startsWith(s))) {
      problems.push(`${field} names a platform tool: ${name} (ADR 0006: the cloudflare plane deploys, not the project).`);
    }
  }
}

// Tracked files, and new files not yet added (so a check before committing sees them too).
const tracked = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], {
  encoding: 'utf8',
})
  .split('\0')
  .filter(Boolean);
for (const file of tracked) {
  if (WRANGLER_FILES.includes(basename(file))) {
    problems.push(`${file} is platform configuration (ADR 0006: the project holds none).`);
  }
}

const workflows = tracked.filter((f) => /^\.github\/workflows\/[^/]+\.ya?ml$/.test(f));
const SECRET_REFERENCE = /secrets\s*(?:\.\s*([A-Za-z_][A-Za-z0-9_-]*)|\[\s*['"]([^'"]+)['"]\s*\])/g;
for (const file of workflows) {
  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    continue; // tracked but deleted in the working tree
  }
  for (const match of text.matchAll(SECRET_REFERENCE)) {
    const name = match[1] ?? match[2];
    if (!ALLOWED_SECRETS.has(name)) {
      problems.push(`${file} references the secret ${name}; only CF_ACCESS_CLIENT_ID and CF_ACCESS_CLIENT_SECRET are allowed (ADR 0006).`);
    }
  }
  if (/^\s*secrets\s*:\s*inherit\b/m.test(text)) {
    problems.push(`${file} passes every secret on with "secrets: inherit" (ADR 0006).`);
  }
  if (/\btoJSON\(\s*secrets\s*\)/.test(text)) {
    problems.push(`${file} reads every secret with toJSON(secrets) (ADR 0006).`);
  }
}

if (problems.length > 0) {
  console.error('check-deps failed:');
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}
console.log(
  `check-deps: no runtime dependencies, framework, platform tool or platform configuration; ` +
    `${workflows.length} workflow(s) reference only the Access secrets.`,
);
