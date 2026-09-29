const SOURCE_ATTRIBUTE = "data-mermaid-source";

let renderQueue = Promise.resolve();
let mermaidModule: Promise<typeof import("mermaid")> | undefined;

function prepareDiagrams(): HTMLElement[] {
  document
    .querySelectorAll<HTMLElement>('pre[data-language="mermaid"] > code')
    .forEach((code) => {
      const pre = code.closest("pre");
      if (!pre) return;

      const diagram = document.createElement("div");
      diagram.className = "mermaid-diagram";
      diagram.setAttribute(SOURCE_ATTRIBUTE, code.textContent ?? "");
      pre.replaceWith(diagram);
    });

  return Array.from(
    document.querySelectorAll<HTMLElement>(`[${SOURCE_ATTRIBUTE}]`),
  );
}

async function renderDiagrams(): Promise<void> {
  const diagrams = prepareDiagrams();
  if (diagrams.length === 0) return;

  diagrams.forEach((diagram) => {
    diagram.textContent = diagram.getAttribute(SOURCE_ATTRIBUTE) ?? "";
    diagram.removeAttribute("data-processed");
  });

  mermaidModule ??= import("mermaid");
  const { default: mermaid } = await mermaidModule;

  mermaid.initialize({
    startOnLoad: false,
    theme:
      document.documentElement.dataset.theme === "dark" ? "dark" : "default",
  });

  await mermaid.run({ nodes: diagrams });
}

function scheduleRender(): void {
  renderQueue = renderQueue.then(renderDiagrams, renderDiagrams);
}

document.addEventListener("astro:page-load", scheduleRender);

new MutationObserver((mutations) => {
  if (mutations.some((mutation) => mutation.attributeName === "data-theme")) {
    scheduleRender();
  }
}).observe(document.documentElement, {
  attributes: true,
  attributeFilter: ["data-theme"],
});
