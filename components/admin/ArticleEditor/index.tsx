"use client";

import dynamic from "next/dynamic";

const NOOP = () => {};

const RichTextEditor = dynamic(
  () => import("./RichTextEditor").then((m) => ({ default: m.RichTextEditor })),
  { ssr: false, loading: () => null }
);

interface ArticleEditorProps {
  initialContent?: object;
  onChange?: (body: object) => void;
}

export default function ArticleEditor({ initialContent, onChange }: ArticleEditorProps) {
  return (
    <div className="article-editor">
      <RichTextEditor initialContent={initialContent} onChange={onChange ?? NOOP} />
    </div>
  );
}
