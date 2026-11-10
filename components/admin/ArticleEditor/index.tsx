"use client";

import { useCallback, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { t } from "@/messages/en";
import type { ImageAttrs } from "./RichTextEditor";

const NOOP = () => {};

const RichTextEditor = dynamic(
  () => import("./RichTextEditor").then((m) => ({ default: m.RichTextEditor })),
  { ssr: false, loading: () => null }
);

const ImageUploadField = dynamic(() => import("./ImageUploadField"), { ssr: false });

interface ArticleEditorProps {
  initialContent?: object;
  onChange?: (body: object) => void;
}

export default function ArticleEditor({ initialContent, onChange }: ArticleEditorProps) {
  const [showImageDialog, setShowImageDialog] = useState(false);
  const insertImageRef = useRef<((attrs: ImageAttrs) => void) | null>(null);

  const handleEditorReady = useCallback(
    (helpers: { insertImage: (attrs: ImageAttrs) => void }) => {
      insertImageRef.current = helpers.insertImage;
    },
    []
  );

  function handleInsertImage(attrs: {
    mediaId: string;
    previewSrc: string;
    alt: string;
    decorative: boolean;
    caption: string;
  }) {
    if (!insertImageRef.current) return;
    insertImageRef.current({
      node_id: crypto.randomUUID(),
      key: attrs.mediaId,
      previewSrc: attrs.previewSrc,
      alt: attrs.alt,
      decorative: attrs.decorative,
      caption: attrs.caption,
    });
    setShowImageDialog(false);
  }

  return (
    <div className="article-editor">
      <div className="article-editor__toolbar">
        <button
          type="button"
          aria-label={t("editor.toolbar.insert_image")}
          onClick={() => setShowImageDialog(true)}
        >
          {t("editor.toolbar.insert_image")}
        </button>
      </div>

      {showImageDialog && (
        <div role="dialog" aria-modal="true" aria-label={t("editor.toolbar.insert_image")}>
          <ImageUploadField
            onInsert={handleInsertImage}
            onCancel={() => setShowImageDialog(false)}
          />
        </div>
      )}

      <RichTextEditor
        initialContent={initialContent}
        onChange={onChange ?? NOOP}
        onEditorReady={handleEditorReady}
      />
    </div>
  );
}
