---
name: blog-svg-diagrams
description: Create and maintain polished, accessible, theme-aware SVG diagrams for this AstroPaper technical blog while preserving an LLM-readable semantic source in Markdown. Use when adding or editing blog diagrams, architecture visuals, sequence diagrams, process flows, or converting Mermaid to SVG.
---

# Blog SVG Diagrams

Create clear, technically accurate SVG diagrams for the AstroPaper blog. Own the visual design; follow the repository's existing design language rather than rigidly copying a template.

## 1. Inspect before designing

1. Read `PROJECT.md`, then inspect the relevant Markdown post when one is in scope, `astro.config.ts`, the AstroPaper theme implementation, and existing diagrams under `public/diagrams/`.
2. Treat existing diagrams, especially `public/diagrams/os-architecture.svg` when present, as visual references, not immutable templates.
3. Identify the article's teaching objective, or the intended message when no article is in scope, and choose the diagram type that best communicates it:
   - Layered architecture: boundaries and responsibilities.
   - Sequence diagram: chronological requests, processing, and returns.
   - Flowchart: decisions and control flow.
   - Process/tree diagram: parent-child relationships and resource ownership.
4. Preserve technical distinctions. If the source description is ambiguous or misleading, correct the diagram and briefly explain the correction.

## 2. Visual principles

### Information density

- Each diagram should communicate one primary concept.
- Prefer 3–5 major visual elements whenever possible.
- Do not visualize every technical detail from the article.
- Leave implementation details, exceptions, and caveats in the surrounding prose.
- If a diagram requires too many arrows or annotations, simplify it or split it into separate diagrams.
- Visual clarity takes priority over information density.
- Treat diagrams as visual aids for the article, not replacements for the article's explanations.

### Visual design

- Produce clean, professional, editorial-quality diagrams suitable for a technical blog.
- Favor legible typography, restrained colors, consistent spacing, aligned elements, subtle borders, and purposeful whitespace.
- Use the existing blog's colors, typography, and visual conventions where practical. A teal accent is appropriate if it matches existing diagrams.
- Differentiate concepts with position, labels, line styles, and grouping—not color alone.
- Use solid arrows for requests/actions and dashed arrows for returns only when that distinction is meaningful. Include clear labels.
- Avoid gratuitous decoration, tiny text, dense layouts, and unnecessary animation.
- Keep all meaningful labels as SVG `<text>` elements rather than converting text to paths. Use local/system font fallbacks; never require remote fonts.
- Use an appropriate `viewBox`; test readability at typical article and mobile widths. If a wide diagram cannot be made legible on mobile, prefer a responsive alternative or a deliberate horizontal-scroll container over microscopic text.

## 3. Light and dark themes

The diagram must follow the **blog's selected theme**, including when it differs from the operating system's theme. Maintain identical content, geometry, spacing, arrow routing, and reading order across themes; change presentation colors only.

1. Inspect how the actual AstroPaper version applies and persists theme choice before selecting an implementation.
2. Do **not** assume `prefers-color-scheme` alone is sufficient: an SVG loaded via Markdown `![...](...)` or HTML `<img>` cannot generally inherit its parent page's classes or CSS custom properties.
3. Choose the simplest reliable approach for the actual project:
   - If embedding permits shared CSS/theme variables, use one SVG with theme-aware styling.
   - For external `<img>` assets, consider matching `-light.svg` and `-dark.svg` variants selected using the site's actual theme state, such as existing theme classes or a reusable Astro component. A CSS `<picture>` media query is sufficient only when the site follows the OS preference without an independent manual override.
   - If using SVG-internal `prefers-color-scheme`, explicitly verify manual site theme overrides still work; otherwise choose another approach.
4. Make text, arrows, boundaries, activation bars, and subtle annotations readable in both themes. Maintain sufficient contrast without excessive glow or harsh highlights.
5. Avoid introducing a second theme state manager or breaking the site's existing theme toggle. Reuse existing theme behavior.

## 4. Preserve an LLM-readable semantic source

An image-only Markdown reference is insufficient: users copy raw `.md` posts into LLMs for technical questions. Keep a compact, editable textual description of the **same** diagram in the post.

- For sequence diagrams and flows, prefer a Mermaid source block.
- For custom architecture diagrams where Mermaid would misrepresent layout, use a concise structured Markdown outline or accurate Mermaid abstraction.
- When displaying an external SVG, place its semantic source in a collapsible `<details>` section near the image, using a fenced `text` block if the intent is to display raw Mermaid without triggering automatic Mermaid rendering. Verify that the site's Markdown pipeline supports this syntax.
- The SVG and semantic source must describe the same participants, boundaries, directions, ordering, and important labels. Update both together.
- Do not paste generated SVG XML into the blog article merely to preserve semantics; keep the article readable.

Example post pattern; replace the asset URL with the path derived from the project's current Astro `base` configuration:

    ![Python requests file data from the Linux kernel](BASE_PATH/diagrams/system-call-sequence.svg)

    <details>
    <summary>다이어그램 원본 보기 (Mermaid)</summary>

    ```text
    sequenceDiagram
        participant P as Python Program
        participant K as Linux Kernel
        P->>K: read(fd, 100)
        K-->>P: Return data
    ```

    </details>

Do not copy `BASE_PATH` literally into a post. Inspect the project's current configuration and existing base-path convention first.

## 5. Technical accuracy and accessibility

- Show conceptual simplifications explicitly in a nearby caption or note.
- In syscall diagrams, distinguish the Python function call, actual OS syscall, CPU privilege transition, kernel processing, and return. Do not imply that the kernel's file-system subsystem is a separate process.
- In process diagrams, `fork()` creates a child while `execve()` replaces a process image without creating another PID.
- Include meaningful `<title>` and `<desc>` inside each SVG, descriptive Markdown alt text, and an accessible reading order.
- Avoid external scripts, external resources, and embedded raster screenshots unless explicitly justified.

## 6. Deliverables and validation

1. Create or edit SVG assets in `public/diagrams/`, using descriptive kebab-case filenames.
2. Integrate the diagram into the requested Markdown article, or provide the exact snippet when article edits were not requested.
3. Add or update its nearby LLM-readable semantic source when an article is in scope.
4. Verify that the SVG is valid, all labels fit, arrows connect correctly, and no text is clipped.
5. Check light mode, dark mode, manual theme overrides, desktop width, and mobile width using the project's available preview/build workflow. Do not claim visual checks were performed if they were not.
6. Follow the repository's validation policy: for SVG/Markdown-only changes, inspect the targeted diff and validate SVG and Markdown syntax; run `npm run build` when code, configuration, Markdown integration, Content Collection behavior, or rendering behavior changes.
7. In the final summary, briefly state the files changed, how theme switching works, where the semantic source lives, and any technical simplifications or unverified visual aspects.

## Working style

Make sensible design decisions independently. Ask for clarification only when a missing technical fact would change the diagram's meaning or implementation. Avoid adding dependencies for a diagram unless the existing stack genuinely needs them. Keep changes scoped to the diagram, its integration, and minimal necessary theme support.