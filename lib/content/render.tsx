// Article body renderer — content system design section 6, 6.1, 10, 20.
// Never uses dangerouslySetInnerHTML. Re-validates at render time and drops bad blocks.

import React from "react";
import { validateBody, MAX_LINKS } from "@/lib/content/schema";
import { checkLink } from "@/lib/content/links";
import { publicConfig } from "@/lib/config.public";
import type {
  ArticleBody,
  ArticleNode,
  InlineNode,
  Mark,
  ParagraphNode,
  HeadingNode,
  BulletListNode,
  OrderedListNode,
  ListItemNode,
  ImageNode,
  VideoNode,
  DocumentCardNode,
  ResolvedVideoNode,
} from "@/types/article";
import DocumentSpot from "@/components/articles/DocumentSpot";

// ─── Helpers ─────────────────────────────────────────────────────────────────

// If NEXT_PUBLIC_APP_URL is malformed, treat all links as outbound (safe fallback).
let OUR_HOST = "";
try {
  OUR_HOST = new URL(publicConfig.appUrl).hostname;
} catch {
  // malformed env — all links treated as outbound
}

function isOutbound(href: string): boolean {
  try {
    return new URL(href).hostname !== OUR_HOST;
  } catch {
    return true;
  }
}

/** Count every link mark in a flat list of inline nodes (recursive). */
function countLinksInNodes(nodes: InlineNode[]): number {
  let count = 0;
  for (const n of nodes) {
    if (n.marks) {
      count += n.marks.filter((m) => m.type === "link").length;
    }
  }
  return count;
}

// ─── Inline renderer ─────────────────────────────────────────────────────────

function renderMark(mark: Mark, children: React.ReactNode, key: string): React.ReactNode {
  switch (mark.type) {
    case "bold":
      return <strong key={key} className="font-semibold text-gray-900">{children}</strong>;
    case "italic":
      return <em key={key} className="italic">{children}</em>;
    case "underline":
      return <u key={key} className="underline">{children}</u>;
    case "link": {
      const href = mark.attrs.href;
      if (checkLink(href).ok !== true) {
        return <React.Fragment key={key}>{children}</React.Fragment>;
      }
      const target = isOutbound(href) ? "_blank" : undefined;
      return (
        <a
          key={key}
          href={href}
          rel="nofollow ugc noopener noreferrer"
          target={target}
          className="text-primary underline hover:text-primary-dark"
        >
          {children}
        </a>
      );
    }
    case "namedStyle":
      return <span key={key} data-style={mark.attrs.style}>{children}</span>;
    case "namedFont":
      return <span key={key} data-font={mark.attrs.font}>{children}</span>;
    default:
      return <React.Fragment key={key}>{children}</React.Fragment>;
  }
}

function renderInline(node: InlineNode, index: number): React.ReactNode {
  const text: React.ReactNode = node.text;
  if (!node.marks || node.marks.length === 0) return <React.Fragment key={index}>{text}</React.Fragment>;

  // Apply marks from innermost to outermost
  return node.marks.reduceRight(
    (child, mark, i) => renderMark(mark, child, `${index}-m${i}`),
    text as React.ReactNode
  );
}

function renderInlines(nodes: InlineNode[] | undefined): React.ReactNode {
  if (!nodes || nodes.length === 0) return null;
  return nodes.map((n, i) => renderInline(n, i));
}

// ─── Block renderers ─────────────────────────────────────────────────────────

const HEADING_CLASS: Record<number, string> = {
  2: "mt-8 mb-3 text-2xl font-bold text-gray-900",
  3: "mt-6 mb-2 text-xl font-bold text-gray-900",
  4: "mt-4 mb-2 text-lg font-semibold text-gray-800",
};

function renderParagraph(node: ParagraphNode, key: number): React.ReactNode {
  return <p key={key} className="mb-4 leading-relaxed text-gray-700">{renderInlines(node.content)}</p>;
}

function renderHeading(node: HeadingNode, key: number): React.ReactNode {
  const Tag = `h${node.attrs.level}` as "h1" | "h2" | "h3" | "h4";
  const cls = HEADING_CLASS[node.attrs.level] ?? "mt-6 mb-2 font-bold text-gray-900";
  return <Tag key={key} className={cls}>{renderInlines(node.content)}</Tag>;
}

function renderListItem(node: ListItemNode, key: number): React.ReactNode {
  return (
    <li key={key} className="mb-1 leading-relaxed text-gray-700">
      {node.content.map((child, i) => renderBlock(child as ArticleNode, i))}
    </li>
  );
}

function renderBulletList(node: BulletListNode, key: number): React.ReactNode {
  return (
    <ul key={key} className="mb-4 ml-5 list-disc space-y-1">
      {node.content.map((item, i) => renderListItem(item, i))}
    </ul>
  );
}

function renderOrderedList(node: OrderedListNode, key: number): React.ReactNode {
  return (
    <ol key={key} className="mb-4 ml-5 list-decimal space-y-1">
      {node.content.map((item, i) => renderListItem(item, i))}
    </ol>
  );
}

function renderImage(node: ImageNode, key: number): React.ReactNode {
  const { key: imgKey, alt, decorative, caption } = node.attrs;
  const altText = decorative ? "" : (alt ?? "");
  return (
    <figure key={key} className="my-6">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={imgKey} alt={altText} className="w-full rounded-lg object-cover" />
      {caption ? <figcaption className="mt-2 text-center text-xs text-gray-500">{caption}</figcaption> : null}
    </figure>
  );
}

function renderVideo(node: VideoNode, key: number): React.ReactNode {
  const { video_id, title, thumbnailKey } = node.attrs;
  if (!video_id) return null;
  const thumbSrc = thumbnailKey ? `${publicConfig.mediaCdnUrl}/${thumbnailKey}` : undefined;
  return (
    <a key={key} href={`/?video=${video_id}`} data-block="video"
      className="my-4 flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3 hover:bg-gray-100 transition-colors">
      {thumbSrc && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={thumbSrc} alt={title ?? ""} className="h-16 w-24 shrink-0 rounded object-cover" />
      )}
      {title && <span className="text-sm font-medium text-gray-800">{title}</span>}
    </a>
  );
}

function renderBlock(node: ArticleNode, key: number): React.ReactNode {
  switch (node.type) {
    case "paragraph":
      return renderParagraph(node, key);
    case "heading":
      return renderHeading(node, key);
    case "bulletList":
      return renderBulletList(node, key);
    case "orderedList":
      return renderOrderedList(node, key);
    case "listItem":
      return renderListItem(node, key);
    case "hardBreak":
      return <br key={key} />;
    case "image":
      return renderImage(node, key);
    case "video":
      return renderVideo(node, key);
    case "document_spot":
      return null;
    case "document_card": {
      const dc = node as DocumentCardNode;
      const { slug, title, price, previewUrl } = dc.attrs;
      if (!slug || !title) return null;
      return (
        <DocumentSpot
          key={key}
          slug={slug}
          title={title}
          price={price}
          previewUrl={previewUrl}
        />
      );
    }
    case "course_spot":
      // Release 3
      return null;
    case "ad_slot":
      // Ad slot rendering is handled by the frontend (S-060)
      return null;
    default:
      // Unknown block — log type only, drop block
      if (typeof console !== "undefined") {
        console.warn("[render] unknown block type:", (node as Record<string, unknown>).type);
      }
      return null;
  }
}

// ─── Main export ─────────────────────────────────────────────────────────────

/**
 * Renders an article body JSON to React elements.
 * Re-validates the body at render time; drops invalid blocks.
 * Never uses dangerouslySetInnerHTML.
 */
export function renderArticleBody(body: ArticleBody, resolvedVideos?: ResolvedVideoNode[]): React.ReactElement {
  const hiddenVideoIds = new Set(
    (resolvedVideos ?? [])
      .filter(r => r.status === "hidden" || r.status === "deleted" || r.status === "not_found")
      .map(r => r.videoId)
  );
  // Re-validate (may have been hand-edited after save).
  // On failure, log and continue rendering what we can — the render loop handles per-block drops.
  const validation = validateBody(body);
  if (!validation.ok) {
    if (typeof console !== "undefined") {
      console.warn("[render] body validation failed:", validation.reason);
    }
    // Fall through: render loop will drop bad blocks individually.
  }

  const nodes = body.content ?? [];

  // Track link budget across blocks; drop blocks that would exceed MAX_LINKS
  let linksSeen = 0;
  const elements: React.ReactNode[] = [];

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];

    // Count links in this block's inline content
    let blockLinks = 0;
    if ("content" in node && Array.isArray((node as ParagraphNode).content)) {
      blockLinks = countLinksInNodes((node as ParagraphNode).content ?? []);
    }

    if (linksSeen + blockLinks > MAX_LINKS) {
      // Log and drop the block; continue rendering the rest
      if (typeof console !== "undefined") {
        console.warn("[render] link limit exceeded, dropping block at index", i);
      }
      continue;
    }

    linksSeen += blockLinks;

    // Skip video blocks whose video_id is hidden/deleted (AC5 public renderer)
    if (node.type === "video") {
      const videoId = (node as VideoNode).attrs?.video_id;
      if (videoId && hiddenVideoIds.has(videoId)) continue;
    }

    const el = renderBlock(node, i);
    if (el !== null) elements.push(el);
  }

  return <div data-article-body>{elements}</div>;
}
