/**
 * Document text extraction.
 * Supports: .docx (via mammoth), .txt, .md
 */

export async function extractText(file: File): Promise<string> {
  const name = file.name.toLowerCase();

  if (name.endsWith(".docx")) {
    return extractDocx(file);
  }

  if (name.endsWith(".txt") || name.endsWith(".md")) {
    return file.text();
  }

  throw new Error(`Unsupported file type: ${file.name}. Please upload .docx or .txt files.`);
}

async function extractDocx(file: File): Promise<string> {
  // mammoth is a CommonJS module — import it dynamically on the server
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mammoth = require("mammoth");
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const result = await mammoth.extractRawText({ buffer });
  return result.value as string;
}
