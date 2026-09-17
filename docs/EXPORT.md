# PDF export

`src/server/export/pdf.ts` renders an `ExportSnapshot` plus its path nodes into a print-ready
comic-issue PDF with `pdf-lib`. Deterministic: the same snapshot, nodes, assets, and asset bytes
always produce the same PDF bytes (no timestamps or randomness in the layout).

## Page geometry

US comic trim, approximated as 477 x 738pt (6.625 x 10.25in). 28pt page margins, 10pt gutters
between grid columns and rows.

## Pages

1. **Cover.** The first path node's first panel's selected asset, contain-fit to the full page,
   with a translucent black band across the bottom third carrying "INKVERSE", the issue title,
   issue number, protagonist name, and style name. If `snapshot.isDraft`, a small red
   "DRAFT: preview artwork" tag is drawn in the top-right corner.
2. **One page per path node**, in the order nodes appear in `input.nodes` filtered to
   `snapshot.pathNodeIds` (nodes not on the path, e.g. unchosen siblings, are skipped entirely,
   including their asset reads). Each page has:
   - The beat title (uppercased as a stand-in for small caps; see Limitations).
   - Panels arranged per `node.beat.layoutTemplate` from `LAYOUTS`: the 12-column grid is mapped
     onto the content width, the `fr` row string mapped proportionally onto the available height,
     and each panel's fixed slot aspect is contain-fit and centered within its grid cell with a
     1.5pt black border.
   - A narration caption band (style paper color) over the top of the first panel, wrapping
     `node.beat.narration`.
   - Bubbles from `snapshot.dialogueVersions[panelId]` if present, else `panel.bubbles`, mapped
     from normalized image-space rects into the panel's actual drawn image area: white bordered
     box for speech (speaker name prefixed, e.g. "NERI:", when `speakerId` is set), dashed box for
     thought, a filled caption strip for caption, bold centered text with no box for sfx. Text
     shrinks (down to 6pt) to fit the bubble.
   - A "You chose: <label>" route caption under the grid for every non-root node.
   - The page number, centered at the bottom.
3. **Ending page.** `snapshot.issue.endingTitle` or "To be continued", the last path node's
   `ending.epilogue` if present, a numbered list of the chosen option labels along the path, and a
   "Made with INKVERSE" footer.

## Side channel

`RenderIssueInput.onPage?: (info: { nodeId: string | null; index: number }) => void` fires once
per emitted page in document order (`nodeId` is `null` for the cover and ending pages). Used by
`tests/export.test.ts` to assert that a sibling node excluded from `pathNodeIds` never produces a
page, without depending on text-stream inspection of the compressed PDF.

## Assets

PNG and JPEG assets are embedded directly via `embedPng` / `embedJpg`. SVG assets
(`mime: image/svg+xml`) are rasterized with `@resvg/resvg-js` to a PNG sized at roughly 2x the
target panel width in points, then embedded, so line art stays crisp at print resolution.
A missing selected asset (no entry in `snapshot.selectedAssets`, or the asset id not present in
`assets`) throws `Error` naming the panel id; the renderer never leaves a panel blank.

## Limitations

- **No true small caps.** pdf-lib's `StandardFonts` (Helvetica / Helvetica-Bold) have no small-caps
  variant and no custom font files were used per the task constraints, so beat titles are
  uppercased instead.
- **No rounded corners.** pdf-lib's `drawRectangle` has no corner-radius option (true rounding
  would need a hand-built SVG path with its own y-flip). Speech/thought/caption bubbles are drawn
  as square-cornered boxes (dashed for thought) rather than rounded speech balloons.
- **Cover art is contain-fit, not cropped full-bleed.** True edge-to-edge bleed would need a clip
  path; the cover image is centered and letterboxed if its aspect does not match the page, with a
  translucent band behind the title block for legibility.
- **Text wrapping is word-based**, not character-based: a single word wider than its box will
  overflow rather than being hyphen-split.
- `renderIssuePages` (the CBZ-oriented helper) was not built. There was no time left in the 18
  minute budget after the primary PDF path and its test; the page-drawing logic above is already
  factored so a rasterize-each-page variant could reuse the same layout/embedding helpers.
