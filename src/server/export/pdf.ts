/**
 * PDF export renderer. Deterministic: same snapshot + assets -> same pages. Owned by the export agent.
 *
 * Page geometry: US comic trim (~6.625 x 10.25in) = 477 x 738pt. 28pt margins, 10pt gutters.
 * Layout: LAYOUTS templates (12-col grid, fr rows) mapped onto the content box per node's beat.
 * Text: pdf-lib StandardFonts only (Helvetica / Helvetica-Bold); no external font files, so
 * "small caps" is approximated with uppercasing (see docs/EXPORT.md limitations).
 */
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type PDFImage, type RGB } from 'pdf-lib';
import { Resvg } from '@resvg/resvg-js';
import type { ExportSnapshot, StoryNode, Asset, StoryBible, Bubble, PanelSpec } from '@shared/schemas';
import { LAYOUTS, aspectRatio } from '@shared/layouts';
import { STYLES, DEFAULT_STYLE } from '@shared/styles';

export interface RenderIssueInput {
  snapshot: ExportSnapshot;
  /** Nodes on the exported path, in order (root first). */
  nodes: StoryNode[];
  assets: Asset[];
  bible: StoryBible;
  /** Reads the durable bytes of an asset (png/jpg/svg). */
  readAsset: (asset: Asset) => Promise<Buffer>;
  /** Optional side channel: called once per emitted page, in document order. nodeId is null for cover/ending pages. */
  onPage?: (info: { nodeId: string | null; index: number }) => void;
}

// ---------- page geometry ----------
const PAGE_W = 477;
const PAGE_H = 738;
const MARGIN = 28;
const GUTTER = 10;
const CONTENT_W = PAGE_W - 2 * MARGIN;
const HEADER_H = 16;
const HEADER_GAP = 6;
const ROUTE_H = 14;
const ROUTE_GAP = 6;
const FOOTER_H = 18;

const BLACK = rgb(0, 0, 0);
const WHITE = rgb(1, 1, 1);

/** Rect in "top-down" content coordinates: x from left margin, yTop = distance from page top. */
interface Rect { x: number; yTop: number; w: number; h: number }

function hexColor(hex: string): RGB {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16) / 255;
  const g = parseInt(h.substring(2, 4), 16) / 255;
  const b = parseInt(h.substring(4, 6), 16) / 255;
  return rgb(r, g, b);
}

/** Convert a top-down rect to pdf-lib's bottom-left-origin x/y/width/height. */
function toPdfRect(r: Rect) {
  return { x: r.x, y: PAGE_H - r.yTop - r.h, width: r.w, height: r.h };
}

/** Baseline y (PDF, bottom-origin) for a line whose top-down offset from page top is `topY`. */
function baselineY(topY: number): number {
  return PAGE_H - topY;
}

// ---------- text helpers ----------
function wrapText(font: PDFFont, text: string, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [''];
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const trial = cur ? `${cur} ${w}` : w;
    if (cur === '' || font.widthOfTextAtSize(trial, size) <= maxWidth) {
      cur = trial;
    } else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

/** Shrinks font size (down to minSize) until wrapped text fits maxHeight; always returns something. */
function fitText(font: PDFFont, text: string, maxWidth: number, maxHeight: number, startSize: number, minSize = 6): { size: number; lines: string[]; lineHeight: number } {
  for (let size = startSize; size >= minSize; size -= 0.5) {
    const lines = wrapText(font, text, size, maxWidth);
    const lineHeight = size * 1.15;
    if (lines.length * lineHeight <= maxHeight + 0.01) return { size, lines, lineHeight };
  }
  const size = minSize;
  const lines = wrapText(font, text, size, maxWidth);
  return { size, lines, lineHeight: size * 1.15 };
}

function drawLinesTopDown(page: PDFPage, font: PDFFont, lines: string[], x: number, yTop: number, size: number, lineHeight: number, color: RGB, opts?: { align?: 'left' | 'center'; maxWidth?: number }) {
  lines.forEach((line, i) => {
    let lx = x;
    if (opts?.align === 'center' && opts.maxWidth !== undefined) {
      const tw = font.widthOfTextAtSize(line, size);
      lx = x + Math.max(0, (opts.maxWidth - tw) / 2);
    }
    const lineTopY = yTop + lineHeight * i + size * 0.85;
    page.drawText(line, { x: lx, y: baselineY(lineTopY), size, font, color });
  });
}

// ---------- grid layout ----------
function parseSpan(spec: string): [number, number] {
  const [a, b] = spec.split('/').map((s) => parseInt(s.trim(), 10));
  return [a - 1, b - 1];
}

function layoutTemplateSlots(templateId: keyof typeof LAYOUTS, grid: Rect): Map<number, Rect> {
  const template = LAYOUTS[templateId];
  const totalColGutter = GUTTER * 11;
  const colWidth = (grid.w - totalColGutter) / 12;
  const rowsFr = template.rows.split(/\s+/).map((tok) => parseFloat(tok));
  const rowSum = rowsFr.reduce((a, b) => a + b, 0);
  const totalRowGutter = GUTTER * Math.max(0, rowsFr.length - 1);
  const availableRowH = grid.h - totalRowGutter;
  const rowHeights = rowsFr.map((fr) => (fr / rowSum) * availableRowH);
  const rowTopOffsets: number[] = [];
  let acc = 0;
  for (let i = 0; i < rowHeights.length; i++) {
    rowTopOffsets.push(acc);
    acc += rowHeights[i] + GUTTER;
  }
  const result = new Map<number, Rect>();
  for (const slot of template.slots) {
    const [colStart, colEnd] = parseSpan(slot.col);
    const [rowStart, rowEnd] = parseSpan(slot.row);
    const x = grid.x + colStart * (colWidth + GUTTER);
    const colSpanCount = colEnd - colStart;
    const w = colSpanCount * colWidth + (colSpanCount - 1) * GUTTER;
    const yTop = grid.yTop + rowTopOffsets[rowStart];
    let h = 0;
    for (let r = rowStart; r < rowEnd; r++) h += rowHeights[r];
    h += (rowEnd - rowStart - 1) * GUTTER;
    result.set(slot.slot, { x, yTop, w, h });
  }
  return result;
}

/** Contain-fit `aspect` (w/h) inside `container`, centered. */
function fitAspectInRect(container: Rect, aspect: number): Rect {
  const containerAspect = container.w / container.h;
  let w: number, h: number;
  if (aspect > containerAspect) {
    w = container.w;
    h = w / aspect;
  } else {
    h = container.h;
    w = h * aspect;
  }
  return { x: container.x + (container.w - w) / 2, yTop: container.yTop + (container.h - h) / 2, w, h };
}

// ---------- asset embedding ----------
type EmbedCache = Map<string, PDFImage>;

async function embedAssetImage(pdfDoc: PDFDocument, asset: Asset, bytes: Buffer, targetWPt: number, targetHPt: number, cache: EmbedCache): Promise<PDFImage> {
  const key = `${asset.id}|${Math.round(targetWPt)}x${Math.round(targetHPt)}`;
  const cached = cache.get(key);
  if (cached) return cached;
  let image: PDFImage;
  if (asset.mime === 'image/png') {
    image = await pdfDoc.embedPng(bytes);
  } else if (asset.mime === 'image/jpeg' || asset.mime === 'image/jpg') {
    image = await pdfDoc.embedJpg(bytes);
  } else if (asset.mime === 'image/svg+xml') {
    const pxW = Math.max(1, Math.round(targetWPt * 2));
    const resvg = new Resvg(bytes.toString('utf8'), { fitTo: { mode: 'width', value: pxW } });
    const rendered = resvg.render();
    const png = rendered.asPng();
    image = await pdfDoc.embedPng(png);
  } else {
    throw new Error(`Unsupported asset mime type "${asset.mime}" for asset ${asset.id}`);
  }
  cache.set(key, image);
  return image;
}

// ---------- bubbles ----------
function drawBubble(page: PDFPage, fonts: { regular: PDFFont; bold: PDFFont }, bubble: Bubble, imgRect: Rect, speakerName: string | undefined) {
  const bx = imgRect.x + bubble.rect.x * imgRect.w;
  const byTop = imgRect.yTop + bubble.rect.y * imgRect.h;
  const bw = Math.max(4, bubble.rect.w * imgRect.w);
  const bh = Math.max(4, bubble.rect.h * imgRect.h);
  const pad = 3;
  const label = bubble.kind === 'speech' && bubble.speakerId ? `${(speakerName ?? bubble.speakerId).toUpperCase()}: ` : '';
  const fullText = label + bubble.text;
  const box = toPdfRect({ x: bx, yTop: byTop, w: bw, h: bh });

  if (bubble.kind === 'sfx') {
    const { size, lines, lineHeight } = fitText(fonts.bold, fullText, bw, bh, 16, 6);
    drawLinesTopDown(page, fonts.bold, lines, bx, byTop, size, lineHeight, BLACK, { align: 'center', maxWidth: bw });
    return;
  }
  if (bubble.kind === 'caption') {
    page.drawRectangle({ x: box.x, y: box.y, width: bw, height: bh, color: WHITE, opacity: 0.9, borderColor: BLACK, borderWidth: 0.75 });
    const { size, lines, lineHeight } = fitText(fonts.regular, fullText, bw - pad * 2, bh - pad * 2, 10, 6);
    drawLinesTopDown(page, fonts.regular, lines, bx + pad, byTop + pad, size, lineHeight, BLACK);
    return;
  }
  // speech or thought
  page.drawRectangle({
    x: box.x,
    y: box.y,
    width: bw,
    height: bh,
    color: WHITE,
    borderColor: BLACK,
    borderWidth: 1,
    ...(bubble.kind === 'thought' ? { borderDashArray: [3, 2] } : {}),
  });
  const { size, lines, lineHeight } = fitText(fonts.regular, fullText, bw - pad * 2, bh - pad * 2, 10, 6);
  drawLinesTopDown(page, fonts.regular, lines, bx + pad, byTop + pad, size, lineHeight, BLACK);
}

// ---------- main render ----------
export async function renderIssuePdf(input: RenderIssueInput): Promise<Uint8Array> {
  const { snapshot, nodes, assets, bible, readAsset, onPage } = input;
  const pdfDoc = await PDFDocument.create();
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fonts = { regular: fontRegular, bold: fontBold };
  const embedCache: EmbedCache = new Map();

  const assetsById = new Map(assets.map((a) => [a.id, a]));
  const charactersById = new Map(bible.characters.map((c) => [c.id, c]));
  const style = STYLES[snapshot.issue.styleId] ?? STYLES[DEFAULT_STYLE];
  const paperColor = hexColor(style.paper);
  const inkColor = hexColor(style.ink);

  const pathNodes = nodes.filter((n) => snapshot.pathNodeIds.includes(n.id));
  if (pathNodes.length === 0) throw new Error('renderIssuePdf: no nodes on the exported path');

  let pageIndex = 0;
  const emitPage = (nodeId: string | null) => {
    onPage?.({ nodeId, index: pageIndex });
    pageIndex++;
  };

  const resolveAsset = (panelId: string): Asset => {
    const assetId = snapshot.selectedAssets[panelId];
    const asset = assetId ? assetsById.get(assetId) : undefined;
    if (!asset) throw new Error(`renderIssuePdf: missing asset for panel "${panelId}"`);
    return asset;
  };

  const drawFooter = (page: PDFPage, pageNumber: number) => {
    const text = String(pageNumber);
    const tw = fontRegular.widthOfTextAtSize(text, 9);
    page.drawText(text, { x: (PAGE_W - tw) / 2, y: MARGIN / 2, size: 9, font: fontRegular, color: BLACK });
  };

  // ---------- cover page ----------
  const rootNode = pathNodes[0];
  const coverPanel: PanelSpec | undefined = rootNode.panels[0];
  if (!coverPanel) throw new Error(`renderIssuePdf: root node "${rootNode.id}" has no panels for the cover`);
  const coverAsset = resolveAsset(coverPanel.id);
  const coverBytes = await readAsset(coverAsset);

  {
    const page = pdfDoc.addPage([PAGE_W, PAGE_H]);
    const fullArea: Rect = { x: 0, yTop: 0, w: PAGE_W, h: PAGE_H };
    const coverImage = await embedAssetImage(pdfDoc, coverAsset, coverBytes, PAGE_W, PAGE_H, embedCache);
    const imgRect = fitAspectInRect(fullArea, coverImage.width / coverImage.height);
    const imgPdf = toPdfRect(imgRect);
    page.drawImage(coverImage, imgPdf);

    // Legibility band at the bottom third for the title block.
    const bandH = 168;
    const bandRect = toPdfRect({ x: 0, yTop: PAGE_H - bandH, w: PAGE_W, h: bandH });
    page.drawRectangle({ x: bandRect.x, y: bandRect.y, width: bandRect.width, height: bandRect.height, color: rgb(0, 0, 0), opacity: 0.55 });

    let cursorTop = PAGE_H - bandH + 14;
    const centerLine = (text: string, font: PDFFont, size: number, color: RGB) => {
      const tw = font.widthOfTextAtSize(text, size);
      page.drawText(text, { x: (PAGE_W - tw) / 2, y: baselineY(cursorTop + size * 0.85), size, font, color });
      cursorTop += size * 1.35;
    };
    centerLine('INKVERSE', fontBold, 22, WHITE);
    centerLine(snapshot.issue.title, fontBold, 15, WHITE);
    centerLine(`Issue #${snapshot.issue.number}`, fontRegular, 10, WHITE);
    centerLine(snapshot.issue.protagonistName, fontRegular, 10, WHITE);
    centerLine(style.name, fontRegular, 9, WHITE);

    if (snapshot.isDraft) {
      const ribbonText = 'DRAFT: preview artwork';
      const size = 9;
      const tw = fontBold.widthOfTextAtSize(ribbonText, size);
      const ribbonW = tw + 16;
      const ribbonH = 18;
      const ribbonRect = toPdfRect({ x: PAGE_W - MARGIN - ribbonW, yTop: MARGIN, w: ribbonW, h: ribbonH });
      page.drawRectangle({ x: ribbonRect.x, y: ribbonRect.y, width: ribbonW, height: ribbonH, color: rgb(0.85, 0.15, 0.1), opacity: 0.92 });
      page.drawText(ribbonText, { x: ribbonRect.x + 8, y: ribbonRect.y + 5, size, font: fontBold, color: WHITE });
    }

    drawFooter(page, pageIndex + 1);
    emitPage(null);
  }

  // ---------- interior pages ----------
  for (const node of pathNodes) {
    const page = pdfDoc.addPage([PAGE_W, PAGE_H]);
    const isRoot = node.parentId === null;
    const hasRoute = !isRoot;

    // header: beat title (uppercased as a stand-in for small caps; StandardFonts has no small-caps feature)
    drawLinesTopDown(page, fontBold, [node.beat.title.toUpperCase()], MARGIN, MARGIN, 10, 12, inkColor);

    const gridTopY = MARGIN + HEADER_H + HEADER_GAP;
    const gridH = PAGE_H - MARGIN - gridTopY - FOOTER_H - (hasRoute ? ROUTE_H + ROUTE_GAP : 0);
    const grid: Rect = { x: MARGIN, yTop: gridTopY, w: CONTENT_W, h: gridH };

    const slots = layoutTemplateSlots(node.beat.layoutTemplate, grid);
    const panelBySlot = new Map(node.panels.map((p) => [p.layoutSlot, p]));
    const template = LAYOUTS[node.beat.layoutTemplate];

    let firstImgRect: Rect | undefined;
    for (const slotDef of template.slots) {
      const panel = panelBySlot.get(slotDef.slot);
      if (!panel) continue;
      const cell = slots.get(slotDef.slot)!;
      const panelBox = fitAspectInRect(cell, aspectRatio(slotDef.aspect));

      const asset = resolveAsset(panel.id);
      const bytes = await readAsset(asset);
      const image = await embedAssetImage(pdfDoc, asset, bytes, panelBox.w, panelBox.h, embedCache);
      const imgRect = fitAspectInRect(panelBox, image.width / image.height);

      const borderPdf = toPdfRect(panelBox);
      const imgPdf = toPdfRect(imgRect);
      page.drawImage(image, imgPdf);
      page.drawRectangle({ x: borderPdf.x, y: borderPdf.y, width: borderPdf.width, height: borderPdf.height, borderColor: BLACK, borderWidth: 1.5, opacity: 0 });

      const bubbles = snapshot.dialogueVersions[panel.id] ?? panel.bubbles;
      for (const bubble of bubbles) {
        const speakerName = bubble.speakerId ? charactersById.get(bubble.speakerId)?.name : undefined;
        drawBubble(page, fonts, bubble, imgRect, speakerName);
      }

      if (firstImgRect === undefined) firstImgRect = imgRect;
    }

    // narration caption box over the top of the first panel
    if (firstImgRect) {
      const bandH = Math.min(64, firstImgRect.h * 0.4);
      const bandRect: Rect = { x: firstImgRect.x, yTop: firstImgRect.yTop, w: firstImgRect.w, h: bandH };
      const bandPdf = toPdfRect(bandRect);
      page.drawRectangle({ x: bandPdf.x, y: bandPdf.y, width: bandPdf.width, height: bandPdf.height, color: paperColor, opacity: 0.92 });
      const pad = 5;
      const { size, lines, lineHeight } = fitText(fontRegular, node.beat.narration, bandRect.w - pad * 2, bandRect.h - pad * 2, 9, 6);
      drawLinesTopDown(page, fontRegular, lines, bandRect.x + pad, bandRect.yTop + pad, size, lineHeight, inkColor);
    }

    // route caption
    if (hasRoute) {
      const routeTopY = PAGE_H - MARGIN - FOOTER_H - ROUTE_H;
      const text = `You chose: ${node.originatingChoice.label}`;
      const tw = fontRegular.widthOfTextAtSize(text, 9);
      page.drawText(text, { x: (PAGE_W - tw) / 2, y: baselineY(routeTopY + 10), size: 9, font: fontRegular, color: inkColor });
    }

    drawFooter(page, pageIndex + 1);
    emitPage(node.id);
  }

  // ---------- ending page ----------
  {
    const page = pdfDoc.addPage([PAGE_W, PAGE_H]);
    const lastNode = pathNodes[pathNodes.length - 1];
    const endingTitle = snapshot.issue.endingTitle ?? 'To be continued';

    let cursorTop = MARGIN + 20;
    const centerLine = (text: string, font: PDFFont, size: number, color: RGB) => {
      const tw = font.widthOfTextAtSize(text, size);
      page.drawText(text, { x: (PAGE_W - tw) / 2, y: baselineY(cursorTop), size, font, color });
      cursorTop += size * 1.5;
    };
    centerLine(endingTitle, fontBold, 18, inkColor);
    cursorTop += 10;

    const epilogue = lastNode?.ending?.epilogue;
    if (epilogue) {
      const { size, lines, lineHeight } = fitText(fontRegular, epilogue, CONTENT_W, 200, 11, 8);
      drawLinesTopDown(page, fontRegular, lines, MARGIN, cursorTop, size, lineHeight, inkColor);
      cursorTop += lines.length * lineHeight + 20;
    }

    const routeLabels = pathNodes.filter((n) => n.parentId !== null).map((n) => n.originatingChoice.label);
    if (routeLabels.length > 0) {
      drawLinesTopDown(page, fontBold, ['Your route:'], MARGIN, cursorTop, 11, 14, inkColor);
      cursorTop += 18;
      routeLabels.forEach((label, i) => {
        const { size, lines, lineHeight } = fitText(fontRegular, `${i + 1}. ${label}`, CONTENT_W, 40, 10, 7);
        drawLinesTopDown(page, fontRegular, lines, MARGIN, cursorTop, size, lineHeight, inkColor);
        cursorTop += lines.length * lineHeight + 2;
      });
    }

    const footerText = 'Made with INKVERSE';
    const fw = fontRegular.widthOfTextAtSize(footerText, 9);
    page.drawText(footerText, { x: (PAGE_W - fw) / 2, y: baselineY(PAGE_H - MARGIN), size: 9, font: fontRegular, color: inkColor });
    drawFooter(page, pageIndex + 1);
    emitPage(null);
  }

  return pdfDoc.save();
}
