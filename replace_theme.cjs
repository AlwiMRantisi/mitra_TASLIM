const fs = require('fs');

const files = [
  'src/app/data-barang/page.tsx',
  'src/app/tipe-material/page.tsx',
  'src/app/merek-barang/page.tsx',
  'src/app/kategori-barang/page.tsx'
];

const replacements = [
  { from: /bg-neutral-900\/50/g, to: 'bg-muted/50' },
  { from: /bg-neutral-900\/60/g, to: 'bg-muted/60' },
  { from: /bg-neutral-900\/80/g, to: 'bg-muted/80' },
  { from: /bg-neutral-900\/20/g, to: 'bg-muted/20' },
  { from: /bg-neutral-900/g, to: 'bg-card' },
  { from: /border-neutral-800\/60/g, to: 'border-border/60' },
  { from: /border-neutral-800/g, to: 'border-border' },
  { from: /text-neutral-200/g, to: 'text-foreground' },
  { from: /text-neutral-300/g, to: 'text-foreground' },
  { from: /text-neutral-400/g, to: 'text-muted-foreground' },
  { from: /hover:bg-neutral-900\/60/g, to: 'hover:bg-muted/60' },
  { from: /hover:bg-neutral-900\/80/g, to: 'hover:bg-muted/80' },
  { from: /hover:border-neutral-700/g, to: 'hover:border-border/80' }
];

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  let original = content;
  for (const { from, to } of replacements) {
    content = content.replace(from, to);
  }
  if (content !== original) {
    fs.writeFileSync(file, content);
    console.log(`Updated ${file}`);
  }
}
