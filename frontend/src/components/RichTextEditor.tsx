import { useEffect, useRef, useState } from "react";
import {
  AlignLeft,
  Bold,
  CaseUpper,
  IndentDecrease,
  IndentIncrease,
  Italic,
  Link2,
  ListOrdered,
  Paperclip,
  Redo2,
  Strikethrough,
  TextQuote,
  Underline,
  Undo2,
} from "lucide-react";
import { cx } from "./ui";

/**
 * Lightweight contentEditable rich-text editor backed by document.execCommand.
 * Supports the toolbar from the Figma: undo/redo, clear formatting,
 * bold/italic/underline, align left, link, ordered list, indent/outdent,
 * blockquote, attachment marker and strikethrough. Active-button state is
 * tracked from the current selection so B/I/U light up while typing.
 */

interface ToolbarItem {
  icon: typeof Bold;
  label: string;
  command: string;
  value?: string;
  stateQuery?: string;
  needsValue?: boolean;
}

const TOOLBAR_GROUPS: ToolbarItem[][] = [
  [
    { icon: Undo2, label: "Undo", command: "undo" },
    { icon: Redo2, label: "Redo", command: "redo" },
  ],
  [{ icon: CaseUpper, label: "Clear formatting", command: "removeFormat" }],
  [
    { icon: Bold, label: "Bold", command: "bold", stateQuery: "bold" },
    { icon: Italic, label: "Italic", command: "italic", stateQuery: "italic" },
    { icon: Underline, label: "Underline", command: "underline", stateQuery: "underline" },
  ],
  [{ icon: AlignLeft, label: "Align left", command: "justifyLeft", stateQuery: "justifyLeft" }],
  [{ icon: Link2, label: "Insert link", command: "createLink", needsValue: true }],
  [
    { icon: ListOrdered, label: "Ordered list", command: "insertOrderedList", stateQuery: "insertOrderedList" },
    { icon: IndentIncrease, label: "Indent", command: "indent" },
    { icon: IndentDecrease, label: "Outdent", command: "outdent" },
    { icon: TextQuote, label: "Quote", command: "formatBlock", value: "blockquote" },
  ],
  [{ icon: Paperclip, label: "Insert attachment", command: "insertAttachment" }],
  [{ icon: Strikethrough, label: "Strikethrough", command: "strikeThrough", stateQuery: "strikeThrough" }],
];

export function RichTextEditor({
  value,
  onChange,
  placeholder = "Type Your Reply...",
  onAttach,
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  onAttach?: () => void;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<Record<string, boolean>>({});

  // Keep the DOM in sync when the value is changed externally (e.g. reset).
  useEffect(() => {
    const el = editorRef.current;
    if (el && el.innerHTML !== value) el.innerHTML = value;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const syncState = () => {
    const el = editorRef.current;
    if (!el) return;
    const sel = window.getSelection();
    const inside = sel && el.contains(sel.anchorNode);
    const next: Record<string, boolean> = {};
    if (inside) {
      for (const group of TOOLBAR_GROUPS) {
        for (const item of group) {
          if (item.stateQuery) {
            try {
              next[item.stateQuery] = document.queryCommandState(item.stateQuery);
            } catch {
              /* not queryable for this command */
            }
          }
          if (item.command === "formatBlock") {
            next[item.value ?? ""] = document.queryCommandState("formatBlock");
          }
        }
      }
    }
    setActive(next);
  };

  const exec = (item: ToolbarItem) => {
    const el = editorRef.current;
    if (!el) return;
    el.focus();
    if (item.command === "insertAttachment") {
      onAttach?.();
      return;
    }
    if (item.needsValue) {
      const url = window.prompt("Link URL", "https://");
      if (!url) return;
      document.execCommand(item.command, false, url);
    } else {
      document.execCommand(item.command, false, item.value);
    }
    onChange(el.innerHTML);
    syncState();
  };

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200">
      {/* Toolbar — onMouseDown prevents losing the text selection */}
      <div className="flex flex-wrap items-center gap-0.5 border-b border-gray-100 bg-white px-3 py-2">
        {TOOLBAR_GROUPS.map((group, gi) => (
          <div key={gi} className="flex items-center gap-0.5">
            {gi > 0 && <span className="mx-1.5 h-4 w-px bg-gray-200" />}
            {group.map((item) => {
              const isActive =
                (item.stateQuery && active[item.stateQuery]) ||
                (item.command === "formatBlock" && active[item.value ?? ""]);
              return (
                <button
                  key={item.label}
                  type="button"
                  title={item.label}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    exec(item);
                  }}
                  className={cx(
                    "flex h-7 w-7 cursor-pointer items-center justify-center rounded-md transition",
                    isActive ? "bg-brand-soft text-brand" : "text-gray-600 hover:bg-gray-100",
                  )}
                >
                  <item.icon className="h-3.5 w-3.5" />
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label="Email body"
        data-placeholder={placeholder}
        onInput={(e) => onChange((e.target as HTMLDivElement).innerHTML)}
        onKeyUp={syncState}
        onMouseUp={syncState}
        onFocus={syncState}
        className="min-h-64 w-full bg-gray-50 px-4 py-3 text-sm leading-relaxed text-gray-900 outline-none focus:bg-gray-50 empty:before:pointer-events-none empty:before:text-gray-400 empty:before:content-[attr(data-placeholder)] focus:outline-none [&_a]:text-brand [&_a]:underline [&_blockquote]:border-l-4 [&_blockquote]:border-amber-400 [&_blockquote]:bg-amber-50 [&_blockquote]:px-4 [&_blockquote]:py-2 [&_blockquote]:font-semibold [&_blockquote]:text-gray-900 [&_ol]:list-decimal [&_ol]:pl-6 [&_ul]:list-disc [&_ul]:pl-6"
      />
    </div>
  );
}
