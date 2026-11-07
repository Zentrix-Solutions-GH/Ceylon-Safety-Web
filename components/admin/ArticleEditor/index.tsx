"use client";

import dynamic from "next/dynamic";

const RichTextEditor = dynamic(
  () => import("./RichTextEditor").then((m) => ({ default: m.RichTextEditor })),
  { ssr: false }
);

interface ArticleEditorProps {
  onChange?: (body: object) => void;
}

export default function ArticleEditor({ onChange }: ArticleEditorProps) {
  return (
    <div className="article-editor">
      <RichTextEditor onChange={onChange ?? (() => {})} />
    </div>
  );
}
