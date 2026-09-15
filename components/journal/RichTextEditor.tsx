"use client";

import { useEffect, useRef } from "react";
import {
  Bold,
  Italic,
  Underline,
  Image as ImageIcon,
  Link as LinkIcon,
  Table as TableIcon,
} from "lucide-react";

const FONT_SIZES = [
  { label: "Small", value: "2" },
  { label: "Normal", value: "3" },
  { label: "Large", value: "5" },
  { label: "Huge", value: "7" },
];

function exec(command: string, value?: string) {
  document.execCommand(command, false, value);
}

function insertTable() {
  const rows = 2;
  const cols = 2;
  let html = '<table style="border-collapse:collapse;width:100%;margin:8px 0;">';
  for (let r = 0; r < rows; r++) {
    html += "<tr>";
    for (let c = 0; c < cols; c++) {
      html += '<td style="border:1px solid #2e2e33;padding:6px;min-width:60px;">&nbsp;</td>';
    }
    html += "</tr>";
  }
  html += "</table><p><br></p>";
  exec("insertHTML", html);
}

export function RichTextEditor({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const isFirstRender = useRef(true);

  // Only push `value` into the DOM on first mount / when it changes
  // externally (e.g. switching notes) — never on every keystroke, or the
  // caret would jump to the start on each render.
  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== value) {
      ref.current.innerHTML = value;
    }
    isFirstRender.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleInput() {
    if (ref.current) onChange(ref.current.innerHTML);
  }

  function insertLink() {
    const url = window.prompt("Link URL");
    if (url) exec("createLink", url);
  }

  function insertImage() {
    const url = window.prompt("Image URL");
    if (url) exec("insertImage", url);
  }

  return (
    <div className="rounded-lg border border-base-700 bg-base-800">
      <div className="flex flex-wrap items-center gap-1 border-b border-base-700 p-1.5">
        <select
          onChange={(e) => exec("formatBlock", e.target.value)}
          defaultValue=""
          className="rounded bg-base-900 px-1.5 py-1 text-[11px] text-ink-300 outline-none"
        >
          <option value="" disabled>
            Paragraph
          </option>
          <option value="p">Paragraph</option>
          <option value="h1">Heading 1</option>
          <option value="h2">Heading 2</option>
          <option value="blockquote">Quote</option>
        </select>

        <select
          onChange={(e) => exec("fontSize", e.target.value)}
          defaultValue=""
          className="rounded bg-base-900 px-1.5 py-1 text-[11px] text-ink-300 outline-none"
        >
          <option value="" disabled>
            Size
          </option>
          {FONT_SIZES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>

        <div className="mx-1 h-4 w-px bg-base-700" />

        <ToolbarButton onClick={() => exec("bold")} icon={Bold} label="Bold" />
        <ToolbarButton onClick={() => exec("italic")} icon={Italic} label="Italic" />
        <ToolbarButton onClick={() => exec("underline")} icon={Underline} label="Underline" />

        <div className="mx-1 h-4 w-px bg-base-700" />

        <ToolbarButton onClick={insertImage} icon={ImageIcon} label="Insert image" />
        <ToolbarButton onClick={insertLink} icon={LinkIcon} label="Insert link" />
        <ToolbarButton onClick={insertTable} icon={TableIcon} label="Insert table" />
      </div>

      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        data-placeholder={placeholder}
        className="min-h-[200px] max-w-2xl px-3 py-3 text-sm leading-relaxed text-ink-300 outline-none [&_a]:text-status-active [&_a]:underline [&_h1]:text-lg [&_h1]:font-semibold [&_h1]:text-ink-50 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-ink-50 [&_blockquote]:border-l-2 [&_blockquote]:border-base-600 [&_blockquote]:pl-3 [&_blockquote]:text-ink-500 [&_img]:max-w-full [&_td]:align-top empty:before:text-ink-500 empty:before:content-[attr(data-placeholder)]"
      />
    </div>
  );
}

function ToolbarButton({
  onClick,
  icon: Icon,
  label,
}: {
  onClick: () => void;
  icon: typeof Bold;
  label: string;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      aria-label={label}
      title={label}
      className="rounded p-1.5 text-ink-300 hover:bg-base-900 hover:text-ink-50"
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}
