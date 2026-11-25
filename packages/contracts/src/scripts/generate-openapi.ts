import { writeFileSync } from 'node:fs';

import { createOpenApiDocument } from '../openapi.js';

// Runs from dist/scripts/, so the package root is two levels up.
const output = new URL('../../openapi.json', import.meta.url);
writeFileSync(output, `${JSON.stringify(createOpenApiDocument(), null, 2)}\n`);
process.stdout.write(`Wrote ${output.pathname}\n`);
