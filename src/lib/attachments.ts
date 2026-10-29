/** Extract supported attachments locally; never send document bytes to a third party. */
export async function extractAttachmentText(file: File): Promise<string> {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (extension === "pdf") {
    const pdfjs = await import("pdfjs-dist");
    pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
    const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), useSystemFonts: true });
    const pdf = await task.promise;
    try {
      const pages: string[] = [];
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const text = await page.getTextContent();
        pages.push(text.items.map(item => "str" in item ? item.str + (item.hasEOL ? "\n" : " ") : "").join(""));
      }
      const text = pages.join("\n\n").trim();
      if (!text) throw new Error("This PDF contains no selectable text. Attach a text document or an image for a vision model.");
      return text;
    } finally { await task.destroy(); }
  }
  if (extension === "docx") {
    const mammoth = await import("mammoth/mammoth.browser");
    const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    return result.value;
  }
  if (!/^(txt|md|markdown|json|csv|tsv|log|yaml|yml|xml|ts|tsx|js|jsx|py|rs|go|cpp|c|h|html|css)$/.test(extension || "")) {
    throw new Error("Use PDF, DOCX, plain text, Markdown, JSON, CSV, or a source-code file.");
  }
  return file.text();
}
