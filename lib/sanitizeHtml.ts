import sanitizeHtml from "sanitize-html";
import type { GraphMailMessage } from "@/lib/graph";

// Server-side HTML sanitizers for the two places the app renders
// third-party / user-authored HTML via dangerouslySetInnerHTML:
//   - Mail bodies fetched from Microsoft Graph (inbound, attacker-controlled)
//   - Playbook bodies written by Managers/Admins (stored)
// Both are strict allowlists: anything not listed (script, style, iframe,
// object, embed, form, input, meta, link, base, svg, every on* handler,
// javascript:/vbscript:/data: links, ...) is dropped. Import this from
// server code only (route handlers / server components) so the parser
// isn't shipped to the browser.

// Inline-style values: no parentheses, colons, backslashes or angle
// brackets, which rules out url(), expression(), var() and escape tricks.
// Colours additionally allow rgb()/rgba() with plain numeric arguments.
const SAFE_VALUE = /^[-#\w\s.,%'"!/]*$/;
const SAFE_COLOR = /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\)|[a-z]+)$/i;

// Deliberately excludes position/z-index/transform etc. so an email can't
// overlay or restyle the surrounding app UI.
const SAFE_STYLE_PROPS = [
  "font-size",
  "font-family",
  "font-weight",
  "font-style",
  "text-align",
  "text-decoration",
  "text-transform",
  "line-height",
  "letter-spacing",
  "white-space",
  "vertical-align",
  "padding",
  "padding-top",
  "padding-right",
  "padding-bottom",
  "padding-left",
  "margin",
  "margin-top",
  "margin-right",
  "margin-bottom",
  "margin-left",
  "border",
  "border-top",
  "border-right",
  "border-bottom",
  "border-left",
  "border-width",
  "border-style",
  "border-radius",
  "border-collapse",
  "border-spacing",
  "width",
  "min-width",
  "max-width",
  "height",
  "min-height",
  "max-height",
];

const SAFE_STYLES: Record<string, RegExp[]> = {
  ...Object.fromEntries(SAFE_STYLE_PROPS.map((p) => [p, [SAFE_VALUE]])),
  color: [SAFE_COLOR],
  "background-color": [SAFE_COLOR],
  "border-color": [SAFE_COLOR],
  display: [/^(none|block|inline|inline-block|table|table-row|table-cell)$/i],
};

// Every link opens in a new tab without giving the target page a handle
// back to this window.
const LINK_TRANSFORM = {
  a: sanitizeHtml.simpleTransform("a", {
    target: "_blank",
    rel: "noopener noreferrer",
  }),
};

const EMAIL_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "p", "br", "div", "span", "b", "strong", "i", "em", "u", "s", "a",
    "ul", "ol", "li", "table", "thead", "tbody", "tfoot", "tr", "td", "th",
    "caption", "img", "h1", "h2", "h3", "h4", "h5", "h6", "blockquote",
    "pre", "code", "hr", "font", "center", "sub", "sup", "small",
  ],
  allowedAttributes: {
    "*": ["style", "title", "align", "dir"],
    a: ["href", "target", "rel"],
    img: ["src", "alt", "width", "height", "border"],
    table: ["width", "border", "cellpadding", "cellspacing", "bgcolor"],
    td: ["colspan", "rowspan", "width", "height", "valign", "bgcolor"],
    th: ["colspan", "rowspan", "width", "height", "valign", "bgcolor"],
    tr: ["valign", "bgcolor"],
    font: ["color", "face", "size"],
  },
  allowedStyles: { "*": SAFE_STYLES },
  allowedSchemes: ["http", "https", "mailto"],
  // Inline images embedded as data URIs. cid: isn't allowed because the
  // mail view doesn't fetch attachments, so those would never resolve.
  allowedSchemesByTag: { img: ["http", "https", "data"] },
  allowProtocolRelative: false,
  // Drop these with their contents (default list + <title>, whose text
  // would otherwise leak into the rendered body).
  nonTextTags: ["script", "style", "textarea", "option", "noscript", "title"],
  transformTags: LINK_TRANSFORM,
};

// Matches what components/journal/RichTextEditor.tsx can produce
// (formatBlock p/h1/h2/blockquote, fontSize -> <font size>, b/i/u, links,
// images, inline-styled tables) plus lists and spans browsers add on paste.
const PLAYBOOK_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "p", "br", "div", "span", "h1", "h2", "h3", "blockquote", "b", "strong",
    "i", "em", "u", "font", "a", "img", "ul", "ol", "li", "table", "thead",
    "tbody", "tr", "td", "th",
  ],
  allowedAttributes: {
    "*": ["style"],
    a: ["href", "target", "rel"],
    img: ["src", "alt", "width", "height"],
    td: ["colspan", "rowspan"],
    th: ["colspan", "rowspan"],
    font: ["size", "color", "face"],
  },
  allowedStyles: { "*": SAFE_STYLES },
  allowedSchemes: ["http", "https", "mailto"],
  allowProtocolRelative: false,
  transformTags: LINK_TRANSFORM,
};

export function sanitizeEmailHtml(html: string): string {
  return sanitizeHtml(html, EMAIL_OPTIONS);
}

export function sanitizePlaybookHtml(html: string): string {
  return sanitizeHtml(html, PLAYBOOK_OPTIONS);
}

// Cleans the HTML bodies of a Graph message list before it leaves the
// server. Plain-text bodies are left alone (the client renders those as
// text, so escaping them here would show literal entities).
export function sanitizeMailMessages(messages: GraphMailMessage[]): GraphMailMessage[] {
  return messages.map((m) =>
    m.body?.contentType?.toLowerCase() === "html"
      ? { ...m, body: { ...m.body, content: sanitizeEmailHtml(m.body.content ?? "") } }
      : m
  );
}
