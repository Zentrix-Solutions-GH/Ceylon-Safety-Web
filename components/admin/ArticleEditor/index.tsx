"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { t } from "@/messages/en";
import { generateSlug, isReservedSlug } from "@/lib/content/slug";
import { saveArticle } from "@/lib/articles/actions/saveArticle";
import PublishTimePicker from "./PublishTimePicker";
import type { ImageAttrs } from "./RichTextEditor";
import type { ArticleEditData, ArticleBody } from "@/types/article";
import type { Author } from "@/types/author";
import type { Category } from "@/types/article";

const RichTextEditor = dynamic(
  () => import("./RichTextEditor").then((m) => ({ default: m.RichTextEditor })),
  { ssr: false, loading: () => null }
);

const ImageUploadField = dynamic(() => import("./ImageUploadField"), { ssr: false });

// ─── localStorage helpers ─────────────────────────────────────────────────────

interface DraftBackup {
  savedAt: number;
  bodyVersion: number;
  title: string;
  slug: string;
  body: object;
  excerpt: string;
  coverImageKey: string | null;
  coverImageAlt: string;
  categoryId: string;
  authorId: string;
  scheduledAt: string | null;
}

function draftKey(articleId: string) {
  return `cs-draft-${articleId}`;
}

function readBackup(articleId: string): DraftBackup | null {
  try {
    const raw = localStorage.getItem(draftKey(articleId));
    return raw ? (JSON.parse(raw) as DraftBackup) : null;
  } catch {
    return null;
  }
}

function writeBackup(articleId: string, backup: DraftBackup): void {
  try {
    localStorage.setItem(draftKey(articleId), JSON.stringify(backup));
  } catch {
    // EC2: silently ignore quota / private-browsing errors
  }
}

function clearBackup(articleId: string): void {
  try {
    localStorage.removeItem(draftKey(articleId));
  } catch {
    // EC2: silently ignore
  }
}

// ─── Publish gating ───────────────────────────────────────────────────────────

interface MissingField {
  key: string;
  label: string;
}

function getMissingFields(opts: {
  title: string;
  slug: string;
  categoryId: string;
  authorId: string;
  authorActive: boolean;
  excerpt: string;
  coverImageKey: string | null;
  coverImageAlt: string;
  coverImageStatus: "ready" | "pending" | "error" | null;
  scheduledAt: string | null;
}): MissingField[] {
  const missing: MissingField[] = [];
  if (!opts.title.trim()) missing.push({ key: "title", label: t("editor.publish.missing.title") });
  if (!opts.slug.trim()) missing.push({ key: "slug", label: t("editor.publish.missing.slug") });
  if (!opts.categoryId) missing.push({ key: "category", label: t("editor.publish.missing.category") });
  if (!opts.authorId) {
    missing.push({ key: "author", label: t("editor.publish.missing.author") });
  } else if (!opts.authorActive) {
    missing.push({ key: "author_inactive", label: t("editor.publish.missing.author_inactive") });
  }
  if (!opts.coverImageKey || !opts.coverImageAlt) {
    missing.push({ key: "cover_image", label: t("editor.publish.missing.cover_image") });
  } else if (opts.coverImageStatus !== "ready") {
    missing.push({ key: "cover_image_pending", label: t("editor.publish.missing.cover_image_pending") });
  }
  if (!opts.excerpt.trim()) missing.push({ key: "excerpt", label: t("editor.publish.missing.excerpt") });
  if (!opts.scheduledAt) missing.push({ key: "publish_time", label: t("editor.publish.missing.publish_time") });
  return missing;
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function ToastMessage({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 4000);
    return () => clearTimeout(timer);
  }, [onDismiss]);
  return <div role="status" aria-live="polite">{message}</div>;
}

// ─── Component ────────────────────────────────────────────────────────────────

export interface ArticleEditorProps {
  initialData: ArticleEditData;
  authors: Author[];
  categories: Category[];
}

export default function ArticleEditor({ initialData, authors, categories }: ArticleEditorProps) {
  // ── Metadata state ──────────────────────────────────────────────────────────
  const [title, setTitle] = useState(initialData.title);
  const [slug, setSlug] = useState(initialData.slug);
  const [slugDirty, setSlugDirty] = useState(false);
  const [slugError, setSlugError] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState(initialData.categoryId);
  const [authorId, setAuthorId] = useState(initialData.authorId);
  const [excerpt, setExcerpt] = useState(initialData.excerpt ?? "");
  const [coverImageKey, setCoverImageKey] = useState(initialData.coverImageKey);
  const [coverImageAlt, setCoverImageAlt] = useState(initialData.coverImageAlt ?? "");
  // coverImageStatus is not held in state: there is no cover-image upload widget in this
  // component yet, so the value cannot change without a page reload. A future story that
  // adds cover-image upload must lift this into state and wire a setter here.
  const coverImageStatus = initialData.coverImageStatus;
  const [scheduledAt, setScheduledAt] = useState<string | null>(initialData.publishedAt);

  // ── Body / save state ───────────────────────────────────────────────────────
  const [body, setBody] = useState<ArticleBody | object>(initialData.body);
  const [bodyVersion, setBodyVersion] = useState(initialData.bodyVersion);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  // ── Restore banner ──────────────────────────────────────────────────────────
  const [pendingBackup, setPendingBackup] = useState<DraftBackup | null>(null);

  // ── Image dialog ────────────────────────────────────────────────────────────
  const [showImageDialog, setShowImageDialog] = useState(false);
  const insertImageRef = useRef<((attrs: ImageAttrs) => void) | null>(null);

  const isPublished = initialData.status === "published";
  const slugLocked = isPublished;

  // ─── Check for restore banner on mount (AC3: only when backup is newer) ─────
  useEffect(() => {
    const backup = readBackup(initialData.id);
    if (backup && backup.bodyVersion >= initialData.bodyVersion) {
      setPendingBackup(backup);
    }
  }, [initialData.id, initialData.bodyVersion]);

  // ─── beforeunload when dirty ─────────────────────────────────────────────────
  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  // ─── Image editor helpers ────────────────────────────────────────────────────
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

  // ─── Slug auto-generation ────────────────────────────────────────────────────
  function handleTitleChange(newTitle: string) {
    setTitle(newTitle);
    setIsDirty(true);
    if (!slugLocked && !slugDirty) {
      const generated = generateSlug(newTitle);
      setSlug(generated);
      setSlugError(isReservedSlug(generated) ? t("editor.metadata.slug_reserved") : null);
    }
  }

  function handleSlugChange(newSlug: string) {
    setSlug(newSlug);
    setSlugDirty(true);
    setIsDirty(true);
    setSlugError(isReservedSlug(newSlug) ? t("editor.metadata.slug_reserved") : null);
  }

  // ─── Save ────────────────────────────────────────────────────────────────────
  const dismissToast = useCallback(() => setToast(null), []);

  async function handleSave() {
    setIsSaving(true);
    // Write backup before save attempt (EC1: preserve on conflict)
    writeBackup(initialData.id, {
      savedAt: Date.now(),
      bodyVersion,
      title,
      slug,
      body,
      excerpt,
      coverImageKey,
      coverImageAlt,
      categoryId,
      authorId,
      scheduledAt,
    });

    try {
      const result = await saveArticle({
        articleId: initialData.id,
        title,
        slug,
        categoryId,
        authorId,
        excerpt,
        coverImageKey: coverImageKey ?? undefined,
        coverImageAlt,
        publishedAt: scheduledAt ?? undefined,
        body: body as ArticleBody,
        bodyVersion,
      });

      if (result.ok) {
        clearBackup(initialData.id); // AC2
        setBodyVersion(result.bodyVersion);
        setIsDirty(false);
        setToast(t("editor.save.saved"));
      } else if (result.code === "refs_inconsistent") {
        setToast(t("editor.save.refs_inconsistent"));
      } else if (result.code === "version_conflict") {
        setToast(t("editor.save.conflict"));
      } else {
        setToast(t("editor.save.error"));
      }
    } catch {
      setToast(t("editor.save.error"));
    } finally {
      setIsSaving(false);
    }
  }

  // ─── Restore banner handlers ─────────────────────────────────────────────────
  function handleRestore() {
    if (!pendingBackup) return;
    setTitle(pendingBackup.title);
    setSlug(pendingBackup.slug);
    setExcerpt(pendingBackup.excerpt);
    setAuthorId(pendingBackup.authorId);
    setCategoryId(pendingBackup.categoryId);
    setScheduledAt(pendingBackup.scheduledAt);
    setBody(pendingBackup.body);
    setCoverImageKey(pendingBackup.coverImageKey);
    setCoverImageAlt(pendingBackup.coverImageAlt);
    setPendingBackup(null);
    setIsDirty(true);
  }

  function handleDiscard() {
    clearBackup(initialData.id);
    setPendingBackup(null);
  }

  // ─── Publish gating ──────────────────────────────────────────────────────────
  const currentAuthor = authors.find((a) => a.id === authorId);
  const missingFields = getMissingFields({
    title,
    slug,
    categoryId,
    authorId,
    authorActive: currentAuthor?.isActive ?? false,
    excerpt,
    coverImageKey,
    coverImageAlt,
    coverImageStatus,
    scheduledAt,
  });

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="article-editor">
      {toast && <ToastMessage message={toast} onDismiss={dismissToast} />}

      {pendingBackup && (
        <div role="alert">
          <span>
            {t("editor.restore.banner").replace(
              "{date}",
              new Date(pendingBackup.savedAt).toLocaleString()
            )}
          </span>
          <button type="button" onClick={handleRestore}>
            {t("editor.restore.button")}
          </button>
          <button type="button" onClick={handleDiscard}>
            {t("editor.restore.discard")}
          </button>
        </div>
      )}

      <div>
        <label htmlFor="editor-title">{t("editor.metadata.title_label")}</label>
        <input
          id="editor-title"
          type="text"
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
        />
      </div>

      {slugLocked ? (
        <div>
          <span>{slug}</span>
          <span>{t("editor.metadata.slug_locked")}</span>
        </div>
      ) : (
        <div>
          <label htmlFor="editor-slug">{t("editor.metadata.slug_label")}</label>
          <input
            id="editor-slug"
            type="text"
            value={slug}
            onChange={(e) => handleSlugChange(e.target.value)}
          />
          {slugError && <span role="alert">{slugError}</span>}
        </div>
      )}

      <div>
        <label htmlFor="editor-category">{t("editor.metadata.category_label")}</label>
        <select
          id="editor-category"
          value={categoryId}
          onChange={(e) => { setCategoryId(e.target.value); setIsDirty(true); }}
        >
          <option value="">— select —</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="editor-author">{t("editor.metadata.author_label")}</label>
        <select
          id="editor-author"
          value={authorId}
          onChange={(e) => { setAuthorId(e.target.value); setIsDirty(true); }}
        >
          <option value="">— select —</option>
          {authors.map((a) => (
            <option key={a.id} value={a.id} disabled={!a.isActive}>
              {a.name}{!a.isActive ? " (inactive)" : ""}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="editor-excerpt">{t("editor.metadata.excerpt_label")}</label>
        <textarea
          id="editor-excerpt"
          value={excerpt}
          onChange={(e) => { setExcerpt(e.target.value); setIsDirty(true); }}
        />
      </div>

      <PublishTimePicker
        value={scheduledAt}
        onChange={(v) => { setScheduledAt(v); setIsDirty(true); }}
      />

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
        initialContent={initialData.body}
        onChange={(newBody) => { setBody(newBody); setIsDirty(true); }}
        onEditorReady={handleEditorReady}
      />

      <div>
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
        >
          {isSaving ? t("editor.save.saving") : t("editor.save.button")}
        </button>

        <div>
          <button
            type="button"
            disabled={missingFields.length > 0}
          >
            {t("editor.publish.button")}
          </button>
          {missingFields.length > 0 && (
            <div>
              <span>{t("editor.publish.missing_intro")}</span>
              <ul>
                {missingFields.map((f) => (
                  <li key={f.key}>{f.label}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
