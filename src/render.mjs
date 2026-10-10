/**
 * Pure HTML template functions for pool.turntide.561.group.
 *
 * This is a narrow, TUFTE-compatible projection rather than a dependency on the unpublished
 * full web-page-tiling-engine. Tidepool needs one document shell and the tufte-* class/data
 * vocabulary its browser helpers already target; richer tiling remains owned upstream.
 */

const MENU = Object.freeze([
  { label: "What Tidepool is", href: "/" },
  { label: "How it works", href: "/how-it-works/" },
  { label: "Join", href: "/join/" },
  { label: "Governance", href: "/governance/" },
  { label: "Members & enterprises", href: "/members/" },
  { label: "Cycles", href: "/cycles/" },
  { label: "Your position", href: "/position/" },
  { label: "Support", href: "/support/" },
  { label: "Risks", href: "/risks/" },
]);

const BASE_STYLES = `
:root{color-scheme:light dark;--tufte-bg:#f0efeb;--tufte-surface:#fbfaf7;--tufte-ink:#24292a;--tufte-muted:#626a68;--tufte-line:#d6d3ca;--tufte-accent:#3e6377;--tufte-danger:#a04b32;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;font-size:15px;background:var(--tufte-bg);color:var(--tufte-ink)}
@media(prefers-color-scheme:dark){:root{--tufte-bg:#15181a;--tufte-surface:#1e2224;--tufte-ink:#dfdfd7;--tufte-muted:#949c98;--tufte-line:#363c3e;--tufte-accent:#86aec2;--tufte-danger:#cf7d5f}}
*{box-sizing:border-box}html{min-height:100%;background:var(--tufte-bg)}body{margin:0;min-height:100%;background:var(--tufte-bg);color:var(--tufte-ink);line-height:1.55}
a{color:var(--tufte-accent)}button,input,select,textarea{font:inherit;color:inherit}input,select,textarea{width:100%;padding:.4rem .55rem;border:1px solid var(--tufte-line);border-radius:.25rem;background:var(--tufte-surface)}
input[type=radio],input[type=checkbox]{width:auto}button{padding:.4rem .8rem;border:1px solid var(--tufte-line);border-radius:.25rem;background:var(--tufte-surface);cursor:pointer}
.tufte-shell{width:min(1080px,100%);margin:auto;padding:1rem}.tufte-masthead{padding:.35rem 0 .7rem;margin-bottom:.6rem;border-bottom:1px solid var(--tufte-line)}
.tufte-eyebrow{margin:0 0 .15rem;color:var(--tufte-muted);font-size:.68rem;font-weight:600;letter-spacing:.14em;text-transform:uppercase}.tufte-masthead h1{margin:0;font-family:ui-serif,Georgia,serif;font-size:1.5rem}
.tufte-subtitle{max-width:50rem;margin:.25rem 0;color:var(--tufte-muted)}[data-tufte-navigation]{display:flex;flex-wrap:wrap;gap:.9rem;margin-top:.7rem}[data-tufte-navigation] a[aria-current=page]{font-weight:700}
.tufte-grid{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:.5rem}.tufte-tile{grid-column:span 12;min-width:0;padding:.8rem 1rem;border:1px solid var(--tufte-line);border-radius:.25rem;background:var(--tufte-surface)}
.tufte-tile>header{margin-bottom:.55rem;padding-bottom:.4rem;border-bottom:1px solid var(--tufte-line)}.tufte-tile h2{margin:0;color:var(--tufte-muted);font-size:.75rem;letter-spacing:.1em;text-transform:uppercase}
.tufte-tile-body>:first-child{margin-top:0}.tufte-tile-body>:last-child{margin-bottom:0}.tufte-form-field{margin-bottom:.65rem}.tufte-form-field label{display:block;margin-bottom:.2rem;font-size:.82rem;font-weight:600}
.tufte-field-description{color:var(--tufte-muted);font-size:.78rem}.tufte-field-error{color:var(--tufte-danger);font-size:.78rem}.tufte-footer{margin-top:.8rem;color:var(--tufte-muted);font-size:.8rem}
.empty-state{padding:.6rem;border:1px dashed var(--tufte-line);color:var(--tufte-muted)}.spec-quote{margin:1rem 0;padding:.6rem 1rem;border-left:3px solid var(--tufte-accent)}.spec-quote footer{color:var(--tufte-muted)}
.tufte-skip{position:absolute;left:-9999px}.tufte-skip:focus{left:1rem;top:1rem;background:var(--tufte-surface);padding:.5rem;z-index:10}
@media(max-width:700px){.tufte-shell{padding:.6rem}[data-tufte-navigation]{gap:.55rem}}
`;

export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/gu, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[char]);
}

export function pageShell({ title, description, activeHref, bodyHtml }) {
  const nav = MENU.map((item) => `<a href="${escapeHtml(item.href)}"${item.href === activeHref ? ' aria-current="page"' : ""}>${escapeHtml(item.label)}</a>`).join("");
  const fullTitle = `${title} — Tidepool`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="description" content="${escapeHtml(description)}"><title>${escapeHtml(fullTitle)}</title><style>${BASE_STYLES}</style></head><body><a class="tufte-skip" href="#tufte-content">Skip to content</a><main class="tufte-shell" id="tufte-content" data-tufte><header class="tufte-masthead"><p class="tufte-eyebrow">Causeway Services</p><h1>${escapeHtml(fullTitle)}</h1><p class="tufte-subtitle">A directed-yield pool: keep your principal, route the yield, vote the split. Affiliated with Turntide.</p><nav data-tufte-navigation aria-label="Tidepool">${nav}</nav></header><div class="tufte-grid"><section class="tufte-tile" id="page" data-role="standard" style="--tile-span:12" aria-labelledby="page-title"><header><h2 id="page-title">${escapeHtml(title)}</h2></header><div class="tufte-tile-body">${bodyHtml}</div></section></div><footer class="tufte-footer"><p>Tidepool's economic and legal rules are grounded in its own specifications — see <a href="/sources/">sources</a>. Participant-governance and operating-state claims are read from explicit Tidepool/Turntide records. Every number is read from a record, never invented; an empty state is stated plainly rather than filled in.</p><p><a href="/support/">Support this work</a> · <a href="/risks/">Risks and falsifiers</a></p></footer></main></body></html>`;
}

export function renderTidepoolForm(form) {
  const fields = (form.fields ?? []).map((field, index) => {
    const id = field.id || `${form.id || "form"}-field-${index + 1}`;
    const name = field.name || `field-${index + 1}`;
    const kind = field.kind || "text";
    const value = field.value ?? "";
    const attrs = [
      `id="${escapeHtml(id)}"`,
      `name="${escapeHtml(name)}"`,
      field.required ? "required" : "",
      field.disabled ? "disabled" : "",
      field.minLength !== undefined ? `minlength="${Number(field.minLength)}"` : "",
      field.maxLength !== undefined ? `maxlength="${Number(field.maxLength)}"` : "",
      field.placeholder !== undefined ? `placeholder="${escapeHtml(field.placeholder)}"` : "",
      field.pattern !== undefined ? `pattern="${escapeHtml(field.pattern)}"` : "",
    ].filter(Boolean).join(" ");
    const control = kind === "textarea"
      ? `<textarea ${attrs}>${escapeHtml(value)}</textarea>`
      : `<input type="${escapeHtml(kind)}" ${attrs} value="${escapeHtml(value)}"${field.checked ? " checked" : ""}>`;
    if (kind === "hidden") return control;
    return `<div class="tufte-form-field"><label for="${escapeHtml(id)}">${escapeHtml(field.label || name)}</label>${control}${field.description ? `<p id="${escapeHtml(id)}-description" class="tufte-field-description">${escapeHtml(field.description)}</p>` : ""}</div>`;
  }).join("");

  const submitters = (form.submitters ?? [{ label: "Submit" }]).map((submitter, index) => `<button type="${escapeHtml(submitter.kind || "submit")}" data-tufte-submitter="${escapeHtml(submitter.id || `submit-${index + 1}`)}">${escapeHtml(submitter.label || "Submit")}</button>`).join("");
  const method = form.method === "get" ? "get" : "post";
  const action = form.action || "";
  return `<form id="${escapeHtml(form.id || "form")}" data-tufte-action="${escapeHtml(action)}" action="${escapeHtml(action)}" ${typeof form.enhance === "boolean" ? `data-tufte-enhance="${form.enhance}" ` : ""}method="${method}">${fields}${submitters}</form>`;
}

export function quoteBlock(spec, blockHtml, sourceMeta) {
  return `<blockquote class="spec-quote" id="quote-${escapeHtml(spec.id)}">
  ${blockHtml}
  <footer>&mdash; <a href="/sources/#${escapeHtml(spec.source)}">${escapeHtml(sourceMeta.title)}</a></footer>
</blockquote>`;
}

export function emptyState(message) {
  return `<p class="empty-state">${escapeHtml(message)}</p>`;
}
