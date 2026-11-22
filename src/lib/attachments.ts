/** Extract supported attachments locally; never send document bytes to a third party. */

export interface LocalOcrOptions {
  task?: "ocr" | "table" | "formula" | "chart" | "seal" | "spotting";
  outputFormat?: "markdown" | "json";
}

/** Run local loopback PaddleOCR-VL-1.6 sidecar (`/api/ocr`) on a scanned PDF or image. */
export async function extractTextViaLocalOcr(
  file: File,
  options: LocalOcrOptions = {}
): Promise<string> {
  const form = new FormData();
  form.append("file", file, file.name);
  form.append("task", options.task || "ocr");
  form.append("output_format", options.outputFormat || "markdown");

  const res = await fetch("/api/ocr", {
    method: "POST",
    body: form,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.success) {
    throw new Error(
      data?.error ||
        "Local OCR sidecar is unavailable. Start `python core/ai/ocr/ocr_server.py` for scanned PDFs."
    );
  }

  if (options.outputFormat === "json") {
    return JSON.stringify(data, null, 2);
  }
  const md = typeof data.markdown === "string" ? data.markdown.trim() : "";
  if (!md) {
    throw new Error("Local OCR returned empty text for this document.");
  }
  return md;
}

/** Render PDF pages to PNG base64 in-browser via PDF.js canvas and run built-in offline Windows OCR. */
async function extractScannedPdfViaWindowsOcr(pdf: any): Promise<string> {
  if (typeof document === "undefined") {
    throw new Error("Canvas rendering unavailable outside browser environment.");
  }

  const maxPages = Math.min(pdf.numPages, 25);
  const images: string[] = [];

  for (let i = 1; i <= maxPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 2.5 });
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.floor(viewport.width));
    canvas.height = Math.max(1, Math.floor(viewport.height));
    const ctx = canvas.getContext("2d");
    if (!ctx) continue;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport }).promise;
    const dataUrl = canvas.toDataURL("image/png");
    const commaIdx = dataUrl.indexOf(",");
    if (commaIdx > 0) {
      images.push(dataUrl.slice(commaIdx + 1));
    }
    canvas.width = 0;
    canvas.height = 0;
  }

  if (images.length === 0) {
    throw new Error("Could not render PDF pages for local OCR.");
  }

  const res = await fetch("/api/ocr", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ images }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.success) {
    throw new Error(data?.error || "Built-in offline OCR failed.");
  }

  const md = typeof data.markdown === "string" ? data.markdown.trim() : "";
  if (!md) {
    throw new Error("No readable text detected in scanned PDF.");
  }
  return md;
}

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
      if (!text) {
        // Tier 2: Try PaddleOCR-VL-1.6 sidecar if running (best for tables/formulas/Markdown)
        try {
          return await extractTextViaLocalOcr(file, { task: "ocr", outputFormat: "markdown" });
        } catch {
          // Tier 3: Zero-setup built-in offline Windows OCR via rendered PDF pages
          try {
            return await extractScannedPdfViaWindowsOcr(pdf);
          } catch (ocrErr: any) {
            throw new Error(
              ocrErr?.message ||
                "This PDF contains no selectable text and offline OCR could not extract text."
            );
          }
        }
      }
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
