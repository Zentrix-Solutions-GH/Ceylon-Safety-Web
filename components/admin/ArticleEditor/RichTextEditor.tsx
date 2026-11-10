"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useEditor, EditorContent, ReactNodeViewRenderer, NodeViewWrapper, type JSONContent, type NodeViewProps } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import { Mark, Node, type Extensions } from "@tiptap/core";
import ImageBlock from "@/components/admin/ArticleEditor/blocks/ImageBlock";
import { t, type MessageKey } from "@/messages/en";
import { SCHEMA_VERSION, MAX_LINK_LENGTH, MAX_TOP_BLOCKS, MAX_LIST_DEPTH, ALLOWED_FONTS, type AllowedFont, validateLinkHref } from "@/lib/content/schema";

// Custom mark for named fonts (AC6)
const NamedFont = Mark.create({
  name: "namedFont",
  addAttributes() {
    return { font: { default: null } };
  },
  parseHTML() {
    return [{ tag: "span[data-font]", getAttrs: (el) => ({ font: (el as HTMLElement).getAttribute("data-font") }) }];
  },
  renderHTML({ HTMLAttributes }) {
    const font = (ALLOWED_FONTS as readonly string[]).includes(HTMLAttributes.font) ? HTMLAttributes.font : null;
    if (!font) return ["span", {}, 0];
    return ["span", { "data-font": font, style: `font-family: ${font}` }, 0];
  },
});

// NodeView wrapper — renders ImageBlock inside the Tiptap canvas (AC2)
function ImageNodeView({ node, deleteNode }: NodeViewProps) {
  const { previewSrc, alt, decorative, caption, key: mediaKey } = node.attrs as {
    previewSrc: string;
    alt: string;
    decorative: boolean;
    caption: string;
    key: string;
    node_id: string;
  };
  return (
    <NodeViewWrapper>
      <ImageBlock
        mediaId={(mediaKey as string) ?? null}
        previewSrc={(previewSrc as string) ?? ""}
        alt={(alt as string) ?? ""}
        decorative={!!(decorative as boolean)}
        caption={(caption as string) ?? ""}
        status="ready"
        onRemove={deleteNode}
        onRetry={() => {}}
      />
    </NodeViewWrapper>
  );
}

// Custom node for image blocks (AC1 — stores mediaId, key, previewSrc, alt, decorative, caption)
const ImageExtension = Node.create({
  name: "image",
  group: "block",
  atom: true,
  addAttributes() {
    return {
      node_id: { default: null },
      key: { default: null },
      previewSrc: { default: "" },
      alt: { default: "" },
      decorative: { default: false },
      caption: { default: "" },
    };
  },
  parseHTML() {
    return [{ tag: "figure[data-image-node]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["figure", { "data-image-node": "true", ...HTMLAttributes }];
  },
  addNodeView() {
    return ReactNodeViewRenderer(ImageNodeView);
  },
});

// Module-level constant — not recreated on render (prevents editor teardown on re-render)
const EXTENSIONS: Extensions = [
  StarterKit.configure({ heading: { levels: [2, 3] } }),
  Underline,
  Link.configure({
    openOnClick: false,
    validate: (href) => validateLinkHref(href) === null,
  }),
  NamedFont,
  ImageExtension,
];

const STYLES: Array<{ value: "paragraph" | "h2" | "h3" | "blockquote"; labelKey: MessageKey }> = [
  { value: "paragraph", labelKey: "editor.style.body" },
  { value: "h2", labelKey: "editor.style.h2" },
  { value: "h3", labelKey: "editor.style.h3" },
  { value: "blockquote", labelKey: "editor.style.quote" },
];

type StyleValue = (typeof STYLES)[number]["value"];

const FONT_LABEL_KEYS: Record<AllowedFont, MessageKey> = {
  Georgia: "editor.font.georgia",
  Arial: "editor.font.arial",
  Roboto: "editor.font.roboto",
  "Open Sans": "editor.font.open_sans",
  Lato: "editor.font.lato",
};

const KNOWN_PASTE_TAGS = new Set(["P", "H1", "H2", "H3", "H4", "H5", "H6", "STRONG", "EM", "U", "A", "UL", "OL", "LI", "BLOCKQUOTE", "BR", "SPAN", "DIV", "B", "I"]);

/**
 * Count root-level structural elements in pasted HTML that will be unwrapped.
 * Script/style/noscript/meta/link are silently discarded and not counted.
 */
/** Returns true if the editor doc contains any image node whose upload is not yet complete (key is null). Used by S-057 save flow to block publish. */
export function hasPendingImageNode(doc: JSONContent): boolean {
  if (!doc.content) return false;
  return doc.content.some((node) => {
    if (node.type === "image") return !node.attrs?.key;
    return hasPendingImageNode(node);
  });
}

export function countUnknownPastedNodes(html: string): number {
  if (typeof document === "undefined") return 0;
  const div = document.createElement("div");
  div.innerHTML = html;
  div.querySelectorAll("script, style, noscript, meta, link").forEach((el) => el.remove());
  const unknownEls = Array.from(div.querySelectorAll("*")).filter(
    (el) => !KNOWN_PASTE_TAGS.has(el.tagName)
  );
  const rootUnknownCount = unknownEls.filter(
    (el) => !el.parentElement || el.parentElement === div || KNOWN_PASTE_TAGS.has(el.parentElement.tagName)
  ).length;
  return rootUnknownCount;
}

/** Returns the list nesting depth at a ProseMirror resolved position. */
export function getListDepthFromResolvedPos(resolvedPos: { depth: number; node: (i: number) => { type: { name: string } } }): number {
  let depth = 0;
  for (let i = 0; i <= resolvedPos.depth; i++) {
    const node = resolvedPos.node(i);
    if (node.type.name === "bulletList" || node.type.name === "orderedList") depth++;
  }
  return depth;
}

export interface ImageAttrs {
  node_id: string;
  key: string;
  previewSrc: string;
  alt: string;
  decorative: boolean;
  caption: string;
}

interface RichTextEditorProps {
  initialContent?: object;
  onChange: (json: object) => void;
  onEditorReady?: (helpers: { insertImage: (attrs: ImageAttrs) => void }) => void;
}

export function RichTextEditor({ initialContent, onChange, onEditorReady }: RichTextEditorProps) {
  const [pasteToast, setPasteToast] = useState<string | null>(null);
  const [isAtBlockLimit, setIsAtBlockLimit] = useState(false);
  const [linkInputOpen, setLinkInputOpen] = useState(false);
  const [linkDraft, setLinkDraft] = useState("");
  const [linkError, setLinkError] = useState<string | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Always up-to-date reference — avoids stale closure in onUpdate
  const onChangeRef = useRef(onChange);
  // Skip the seed effect when initialContent is already passed to useEditor (sync case)
  const contentSeededRef = useRef(!!initialContent);
  const prevInitialContentRef = useRef<object | undefined>(initialContent);

  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);
  const onEditorReadyRef = useRef(onEditorReady);
  useEffect(() => { onEditorReadyRef.current = onEditorReady; }, [onEditorReady]);

  // F4 fix: cancel toast timer on unmount
  useEffect(() => () => { if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current); }, []);

  const handlePasteTransform = useCallback((html: string): string => {
    if (typeof document === "undefined") return html;
    const div = document.createElement("div");
    div.innerHTML = html;
    // Remove elements whose text must not be promoted into the article body
    div.querySelectorAll("script, style, noscript, meta, link").forEach((el) => el.remove());
    const unknownEls = Array.from(div.querySelectorAll("*")).filter(
      (el) => !KNOWN_PASTE_TAGS.has(el.tagName)
    );
    // Count root-level structural unknowns for toast BEFORE DOM mutations change parentElement
    const count = unknownEls.filter(
      (el) => !el.parentElement || el.parentElement === div || KNOWN_PASTE_TAGS.has(el.parentElement.tagName)
    ).length;
    for (const el of unknownEls) {
      el.replaceWith(...Array.from(el.childNodes));
    }
    if (count > 0) {
      setPasteToast(t("editor.paste_cleaned", { count: String(count) }));
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
      toastTimeoutRef.current = setTimeout(() => setPasteToast(null), 4000);
    }
    return div.innerHTML;
  }, []);

  const editor = useEditor({
    extensions: EXTENSIONS,
    content: initialContent as JSONContent | undefined,
    editorProps: {
      transformPastedHTML: handlePasteTransform,
      handleKeyDown: (_view, event) => {
        // AC4: Block Tab from nesting lists beyond MAX_LIST_DEPTH
        if (event.key === "Tab" && !event.shiftKey) {
          // Use _view.state (not editor) to avoid stale closure on first render
          const { state } = _view;
          const depth = getListDepthFromResolvedPos(state.doc.resolve(state.selection.from));
          if (depth >= MAX_LIST_DEPTH) {
            event.preventDefault();
            return true;
          }
        }
        return false;
      },
    },
    onUpdate: ({ editor: e }) => {
      const json = e.getJSON();
      onChangeRef.current({ ...json, schema_version: SCHEMA_VERSION });
      const topBlocks = Array.isArray(json.content) ? json.content.length : 0;
      setIsAtBlockLimit(topBlocks > MAX_TOP_BLOCKS);
    },
  });

  // Seed content on async arrival or article swap; skip if already seeded synchronously
  useEffect(() => {
    if (!editor || !initialContent) return;
    if (contentSeededRef.current && initialContent === prevInitialContentRef.current) return;
    prevInitialContentRef.current = initialContent;
    contentSeededRef.current = true;
    editor.commands.setContent(initialContent as JSONContent);
  }, [editor, initialContent]);

  // Initialise isAtBlockLimit from seeded content (onUpdate won't fire until a user edit)
  useEffect(() => {
    if (!editor) return;
    const json = editor.getJSON();
    const topBlocks = Array.isArray(json.content) ? json.content.length : 0;
    setIsAtBlockLimit(topBlocks > MAX_TOP_BLOCKS);
  }, [editor]);

  // Expose insertImage helper to parent (ArticleEditor)
  useEffect(() => {
    if (!editor || !onEditorReadyRef.current) return;
    onEditorReadyRef.current({
      insertImage: (attrs: ImageAttrs) => {
        editor.chain().focus().insertContent({ type: "image", attrs }).run();
      },
    });
  }, [editor]);

  function applyStyle(value: StyleValue) {
    if (!editor) return;
    if (value === "paragraph") {
      editor.chain().focus().setParagraph().run();
    } else if (value === "h2") {
      editor.chain().focus().setHeading({ level: 2 }).run();
    } else if (value === "h3") {
      editor.chain().focus().setHeading({ level: 3 }).run();
    } else if (value === "blockquote") {
      editor.chain().focus().setBlockquote().run();
    }
  }

  function getCurrentStyle(): StyleValue {
    if (!editor) return "paragraph";
    if (editor.isActive("heading", { level: 2 })) return "h2";
    if (editor.isActive("heading", { level: 3 })) return "h3";
    if (editor.isActive("blockquote")) return "blockquote";
    return "paragraph";
  }

  function getCurrentFont(): AllowedFont | "" {
    if (!editor) return "";
    for (const font of ALLOWED_FONTS) {
      if (editor.isActive("namedFont", { font })) return font;
    }
    return "";
  }

  function applyFont(font: AllowedFont | "") {
    if (!editor) return;
    if (!font) {
      editor.chain().focus().unsetMark("namedFont").run();
    } else {
      editor.chain().focus().setMark("namedFont", { font }).run();
    }
  }

  function handleLinkApply(e: React.FormEvent) {
    e.preventDefault();
    const url = linkDraft.trim();
    if (!url) return;
    if (url.length > MAX_LINK_LENGTH) {
      setLinkError(t("editor.link.too_long"));
      return;
    }
    const error = validateLinkHref(url);
    if (error) {
      const isSchemeOrFormatError = error.includes("scheme") || error.includes("not a valid URL");
      setLinkError(isSchemeOrFormatError ? t("editor.link.invalid_scheme") : t("editor.link.invalid_url"));
      return;
    }
    editor?.chain().focus().setLink({ href: url }).run();
    setLinkInputOpen(false);
    setLinkDraft("");
    setLinkError(null);
  }

  return (
    <div className="rich-text-editor" role="group" aria-label={t("editor.container_label")}>
      <div className="editor-toolbar" role="toolbar" aria-label={t("editor.toolbar_label")}>
        {/* Style dropdown (AC2) */}
        <label htmlFor="style-select" className="sr-only">
          {t("editor.style.select_label")}
        </label>
        <select
          id="style-select"
          aria-label={t("editor.style.select_label")}
          value={getCurrentStyle()}
          onChange={(e) => applyStyle(e.target.value as StyleValue)}
        >
          {STYLES.map((s) => (
            <option key={s.value} value={s.value}>
              {t(s.labelKey)}
            </option>
          ))}
        </select>

        {/* Font dropdown (AC6) */}
        <label htmlFor="font-select" className="sr-only">
          {t("editor.font.select_label")}
        </label>
        <select
          id="font-select"
          aria-label={t("editor.font.select_label")}
          value={getCurrentFont()}
          onChange={(e) => applyFont(e.target.value as AllowedFont | "")}
        >
          <option value="">{t("editor.font.default")}</option>
          {ALLOWED_FONTS.map((font) => (
            <option key={font} value={font}>
              {t(FONT_LABEL_KEYS[font])}
            </option>
          ))}
        </select>

        <button
          type="button"
          aria-label={t("editor.toolbar.bold")}
          aria-pressed={editor?.isActive("bold") ?? false}
          onClick={() => editor?.chain().focus().toggleBold().run()}
        >
          {t("editor.toolbar.bold_symbol")}
        </button>

        <button
          type="button"
          aria-label={t("editor.toolbar.italic")}
          aria-pressed={editor?.isActive("italic") ?? false}
          onClick={() => editor?.chain().focus().toggleItalic().run()}
        >
          {t("editor.toolbar.italic_symbol")}
        </button>

        <button
          type="button"
          aria-label={t("editor.toolbar.underline")}
          aria-pressed={editor?.isActive("underline") ?? false}
          onClick={() => editor?.chain().focus().toggleUnderline().run()}
        >
          {t("editor.toolbar.underline_symbol")}
        </button>

        <button
          type="button"
          aria-label={t("editor.toolbar.link")}
          aria-pressed={editor?.isActive("link") ?? false}
          onClick={() => {
            setLinkDraft(editor?.getAttributes("link").href ?? "");
            setLinkError(null);
            setLinkInputOpen((open) => !open);
          }}
        >
          {t("editor.toolbar.link_text")}
        </button>

        <button
          type="button"
          aria-label={t("editor.toolbar.bullet_list")}
          aria-pressed={editor?.isActive("bulletList") ?? false}
          disabled={isAtBlockLimit && !editor?.isActive("bulletList")}
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
        >
          {t("editor.toolbar.bullet_symbol")}
        </button>

        <button
          type="button"
          aria-label={t("editor.toolbar.numbered_list")}
          aria-pressed={editor?.isActive("orderedList") ?? false}
          disabled={isAtBlockLimit && !editor?.isActive("orderedList")}
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
        >
          {t("editor.toolbar.numbered_symbol")}
        </button>
      </div>

      {/* Inline link input — replaces window.prompt */}
      {linkInputOpen && (
        <form onSubmit={handleLinkApply} className="editor-link-form">
          <input
            type="url"
            value={linkDraft}
            onChange={(e) => { setLinkDraft(e.target.value); setLinkError(null); }}
            placeholder={t("editor.link.placeholder")}
            aria-label={t("editor.link.url_label")}
            autoFocus
          />
          {linkError && <span role="alert" className="editor-link-error">{linkError}</span>}
          <button type="submit">{t("editor.link.apply")}</button>
          <button type="button" onClick={() => { setLinkInputOpen(false); setLinkError(null); }}>
            {t("editor.link.cancel")}
          </button>
        </form>
      )}

      {/* EC2: block limit warning */}
      {isAtBlockLimit && (
        <p role="alert" className="editor-block-limit-warning">
          {t("editor.blocks_limit")}
        </p>
      )}

      {/* AC3: paste-clean toast */}
      {pasteToast && (
        <p role="status" className="editor-paste-toast">
          {pasteToast}
        </p>
      )}

      <EditorContent editor={editor} />
    </div>
  );
}
