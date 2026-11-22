// Tries the drawing agent on a mock request: `npm run agent [-- image]`.
// The request, style, and annotations come from mock/input.json; the image argument overrides its image.
// Needs OPENROUTER_API_KEY, in the environment or in the root .env.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, extname, resolve } from "node:path";
import { openrouter } from "@openrouter/ai-sdk-provider";
import { ToolLoopAgent, type ModelMessage } from "ai";
import type { Annotation, PenPath } from "../../src/utils/annotations/types.ts";
import { validateOutput } from "./validate.mts";

const MAX_RETRIES = 4;
const MODEL = process.env.AGENT_MODEL ?? "google/gemini-4-argon";

type Input = {
  request: string;
  /** Relative to the input file. */
  image: string;
  style: { stroke: string; strokeWidth: number };
  annotations: Annotation[];
};

const here = import.meta.dirname;
const inputPath = resolve(here, "mock/input.json");
const input = JSON.parse(await readFile(inputPath, "utf8")) as Input;
const imagePath = process.argv[2] ? resolve(process.argv[2]) : resolve(dirname(inputPath), input.image);
const image = await readFile(imagePath);
// Read from the file itself: the server knows the real size, and a wrong size skews every point.
const { width, height, mediaType } = imageInfo(image);

const agent = new ToolLoopAgent({
  model: openrouter(MODEL),
  instructions: await readFile(resolve(here, "prompt.md"), "utf8"),
  // No tools for the MVP; the annotations come in the request.
  tools: {},
});

const messages: ModelMessage[] = [
  {
    role: "user",
    content: [
      {
        type: "text",
        text: [
          `Request: "${input.request}"`,
          `Image size: ${width} x ${height}`,
          `Line style: stroke "${input.style.stroke}", strokeWidth ${input.style.strokeWidth}`,
          `Existing annotations: ${JSON.stringify(input.annotations)}`,
        ].join("\n"),
      },
      { type: "file", mediaType, data: image },
    ],
  },
];

console.log(`Model: ${MODEL}\nImage: ${basename(imagePath)} (${width} x ${height})\nRequest: "${input.request}"\n`);

let paths: PenPath[] | null = null;
for (let attempt = 0; attempt <= MAX_RETRIES && !paths; attempt++) {
  const started = Date.now();
  const result = await agent.generate({ messages });
  const check = validateOutput(result.text, { width, height, existing: input.annotations });
  const secs = ((Date.now() - started) / 1000).toFixed(1);
  const label = attempt === 0 ? "First try" : `Retry ${attempt}/${MAX_RETRIES}`;
  console.log(`${label} (${secs}s, ${result.usage.totalTokens ?? "?"} tokens): ${check.ok ? "valid" : "invalid"}`);

  if (check.ok) {
    paths = check.paths;
    break;
  }
  for (const e of check.errors) console.log(`  - ${e}`);
  messages.push(...result.responseMessages, {
    role: "user",
    content: `Your output failed validation:\n${check.errors.map((e) => `- ${e}`).join("\n")}\nReturn the corrected JSON only.`,
  });
}

if (!paths) {
  console.error(`\nGave up after ${MAX_RETRIES} retries.`);
  process.exit(1);
}

const outDir = resolve(here, "out", basename(imagePath, extname(imagePath)));
await mkdir(outDir, { recursive: true });
await writeFile(resolve(outDir, "doc.json"), JSON.stringify({ annotations: paths }, null, 2));
await writeFile(resolve(outDir, "preview.svg"), preview([...input.annotations, ...paths]));

console.log(`\n${paths.length} path(s), ${paths.reduce((n, p) => n + p.anchors.length, 0)} anchor(s) added.`);
console.log(`Output:  ${resolve(outDir, "doc.json")}`);
console.log(`Preview: ${resolve(outDir, "preview.svg")} (open in a browser)`);

// The photo with every path drawn on it, existing and new, in image pixels.
function preview(annotations: Annotation[]) {
  const shapes = annotations
    .filter((a): a is PenPath => a.kind === "path")
    .map((p) => {
      const pts = p.anchors.map((a) => `${a.point.x},${a.point.y}`).join(" ");
      const dots = p.anchors
        .map((a) => `<circle cx="${a.point.x}" cy="${a.point.y}" r="${p.strokeWidth * 2}" fill="${p.stroke}"/>`)
        .join("");
      const tag = p.closed ? "polygon" : "polyline";
      return `<${tag} points="${pts}" fill="none" stroke="${p.stroke}" stroke-width="${p.strokeWidth}"/>${dots}`;
    })
    .join("\n");
  const href = `data:${mediaType};base64,${image.toString("base64")}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">
<image href="${href}" width="${width}" height="${height}"/>
${shapes}
</svg>
`;
}

function imageInfo(buf: Buffer) {
  // PNG: size is in the IHDR chunk right after the signature.
  if (buf.readUInt32BE(0) === 0x89504e47) {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20), mediaType: "image/png" };
  }
  // JPEG: walk the segments to the first start-of-frame marker.
  if (buf.readUInt16BE(0) === 0xffd8) {
    let i = 2;
    while (i < buf.length) {
      const marker = buf.readUInt16BE(i);
      const isFrame = marker >= 0xffc0 && marker <= 0xffcf && ![0xffc4, 0xffc8, 0xffcc].includes(marker);
      if (isFrame) return { width: buf.readUInt16BE(i + 7), height: buf.readUInt16BE(i + 5), mediaType: "image/jpeg" };
      i += 2 + buf.readUInt16BE(i + 2);
    }
  }
  throw new Error("Image must be a PNG or JPEG.");
}
