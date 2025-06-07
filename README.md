# Synthase

**Synthase** is a tiny TypeScript-first runner that stitches together Minecraft-schematic scripts (e.g. “cuboid”, “city”, …) into bigger, composable builds.
It can pre-warm every dependency into a single QuickJS + WASM context, then execute your scripts on-demand with *any* parameters — all without serialising intermediate schematics.

Built and watched with Bun, ships as plain ESM.

## Install

```
bun add synthase      # or: npm i synthase / pnpm add synthase
```
## Hello World

```typescript
import { SynthaseRunner } from "synthase";

const runner = new SynthaseRunner();

// 1 ▪ Pre-load a root script (and everything it imports)
//   using our custom “\.syn” extension.
const job = await runner.plan("https://cdn.example.com/scripts/city.syn");

// 2 ▪ Inspect I/O metadata — handy for API validation or UI generation
console.log(job.io.inputs);
/*
{
  plots: "int",
  w:     "int",
  d:     "int",
  h:     "int",
  block: "BlockId"
}
*/

// 3 ▪ Validate user params (very crude example)
function validate(params, schema) {
  for (const k in schema)
    if (!(k in params)) throw new Error(`missing ${k}`);
}
validate({ plots:3, w:8, d:8, h:15, block:"minecraft:stone" }, job.io.inputs);

// 4 ▪ Run it
const { schematic } = await job.call({
  plots: 3,
  w:     8,
  d:     8,
  h:     15,
  block: "minecraft:stone"
});

// 5 ▪ Use the live Schematic object …
schematic.save("city.schem");
```
## Using the I/O metadata in an Express API

```typescript
import express from "express";
import { SynthaseRunner } from "synthase";
import { z } from "zod";

const runner = new SynthaseRunner();
const job    = await runner.plan("city.syn");

const inputSchema = z.object(
  Object.fromEntries(
    Object.keys(job.io.inputs).map(k => [k, z.any()])
  )
);

const app = express();
app.use(express.json());

app.post("/run/city", async (req, res) => {
  try {
    inputSchema.parse(req.body);      // validate
    const result = await job.call(req.body);
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});
app.listen(4000);
```
## Dev workflow

bun run dev      # watches src/ → dist/ in <50 ms
bun run build    # one-shot production build (minified, d.ts, maps)
bun test         # bun test (optional unit tests)
## Roadmap

- JSON-Schema validation baked-in
- Timeouts & memory quotas per script
- Typed helper SDK for script authors
- CLI wrapper (synthase plan | run)
- Registry UI for publishing & approving scripts

## License
AGPL-3.0