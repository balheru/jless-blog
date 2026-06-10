#!/usr/bin/env node
// Deterministically generates 75 test articles as markdown content files,
// porting the prototype's seeded PRNG and templates (prototype/index.html).
// Re-running always produces identical output.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'content', 'posts');

let seed = 12345;
function seedRandom() {
  const x = Math.sin(seed++) * 10000;
  return x - Math.floor(x);
}

const titles = [
  'Exploring the Limits of {tech}',
  'A Deep Dive into {topic}',
  'Why {tech} is the Future of {field}',
  'The Mathematics of {topic}',
  'Hacking {tech} for Fun and Profit',
  'Understanding {topic} in Modern Systems',
  'Symmetry and {topic} in Theory',
  'Building a {tech} Engine from Scratch',
  'The Hidden Geometry of {topic}',
  'Optimizing {tech} Compiler Performance'
];

const techs = ['JavaScript', 'Rust', 'WebAssembly', 'C++', 'Python', 'Linux Kernel', 'Docker', 'Git', 'CSS', 'SQL'];
const topics = ['Noetherian Rings', 'Cons Cells', 'Lagrangian Mechanics', 'Focus Traps', 'Quantum Symmetries', 'Category Theory', 'Neural Networks', 'Lisp Interpreters', 'Parser Generators', 'Distributed Consensus'];
const fields = ['Systems Programming', 'Theoretical Physics', 'Web Architecture', 'Functional Programming', 'Compiler Design', 'Cryptography'];

const paragraphs = [
  'In this article, we examine the core principles of {topic} and how they apply to modern systems. Many developers overlook the mathematical foundations, which leads to suboptimal designs.',
  'Using {tech} allows us to bypass standard limitations. By writing custom memory managers or optimizing compilation paths, we can achieve significant speedups in execution speed.',
  'Historically, {field} was dominated by heavy graphical user interfaces. Today, the shift towards keyboard-driven terminal aesthetics has changed how we parse and interact with structured information.',
  'We can represent the underlying structures as a directed acyclic graph. Traversing this hierarchy structurally using algorithms derived from category theory yields modular implementations.',
  'In conclusion, the intersection of {tech} and {topic} offers fertile ground for research. Future investigations will focus on reducing latency and improving developer ergonomics.'
];

const tags = ['hacker', 'vim', 'physics', 'math', 'compiler', 'systems', 'web', 'ux', 'javascript', 'rust', 'lisp', 'mechanics'];

const fill = (s, tech, topic, field) =>
  s.replace('{tech}', tech).replace('{topic}', topic).replace('{field}', field);

// Past 10 years (June 2016 to June 2026)
const startDate = new Date(2016, 5, 8).getTime();
const endDate = new Date(2026, 5, 8).getTime();

mkdirSync(OUT_DIR, { recursive: true });

for (let i = 0; i < 75; i++) {
  const randomTime = startDate + seedRandom() * (endDate - startDate);
  const dateObj = new Date(randomTime);
  const year = String(dateObj.getFullYear());
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  const dateStr = `${year}-${month}-${day}`;

  const tech = techs[Math.floor(seedRandom() * techs.length)];
  const topic = topics[Math.floor(seedRandom() * topics.length)];
  const field = fields[Math.floor(seedRandom() * fields.length)];

  const title = fill(titles[Math.floor(seedRandom() * titles.length)], tech, topic, field);

  const body = [`*Generated test article in the database for date ${dateStr}.*`];
  for (let p = 0; p < 3; p++) {
    body.push(fill(paragraphs[Math.floor(seedRandom() * paragraphs.length)], tech, topic, field));
  }

  const numTags = 2 + Math.floor(seedRandom() * 3);
  const shuffledTags = [...tags].sort(() => 0.5 - seedRandom());
  const postTags = shuffledTags.slice(0, numTags);

  const summary = `A generated test article discussing ${tech} and ${topic} in the field of ${field}.`;

  const frontmatter = [
    '---',
    `title: ${JSON.stringify(title)}`,
    `date: "${dateStr}"`,
    'author: "generated_bot"',
    `tags: ${JSON.stringify(postTags)}`,
    `summary: ${JSON.stringify(summary)}`,
    '---'
  ].join('\n');

  const md = `${frontmatter}\n\n# ${title}\n\n${body.join('\n\n')}\n`;
  writeFileSync(join(OUT_DIR, `generated-post-${i}.md`), md);
}

console.log(`Wrote 75 generated posts to ${OUT_DIR}`);
