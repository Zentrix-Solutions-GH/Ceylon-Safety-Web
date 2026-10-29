import type React from "react";

// AC8: alt or decorative is required at the type level.
type AltProps = { alt: string; decorative?: never };
type DecorativeProps = { decorative: true; alt?: never };

type ResponsiveImageProps = {
  src480?: string;
  src1200?: string;
  width: number;
  height: number;
  // AC6: lazy-loads by default; pass eager for the first visible image on a page.
  eager?: boolean;
  className?: string;
  style?: React.CSSProperties;
} & (AltProps | DecorativeProps);

// AC6: plain <img> — Next.js image optimiser is off (next.config: images.unoptimized).
// AC6: srcset at 480/1200 w; sizes guides the browser to pick the right variant.
// AC7: single variant → plain src, no srcset.
// EC3: both variants missing → <span> spacer keeps the layout space.
export function ResponsiveImage({
  src480,
  src1200,
  width,
  height,
  eager,
  className,
  style,
  ...altProps
}: ResponsiveImageProps) {
  const altText = "alt" in altProps && altProps.alt !== undefined ? altProps.alt : "";
  const hasSrc480 = Boolean(src480);
  const hasSrc1200 = Boolean(src1200);

  // EC3: no usable URL — keep the layout space with a transparent spacer.
  if (!hasSrc480 && !hasSrc1200) {
    return (
      <span
        aria-hidden="true"
        style={{ display: "inline-block", width: `${width}px`, height: `${height}px`, ...style }}
        className={className}
      />
    );
  }

  // AC7: one variant only → plain <img src>.
  if (!hasSrc1200) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src480}
        width={width}
        height={height}
        alt={altText}
        loading={eager ? "eager" : "lazy"}
        className={className}
        style={style}
      />
    );
  }

  // AC6: both variants → srcset.
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src480}
      srcSet={`${src480} 480w, ${src1200} 1200w`}
      sizes="(max-width: 600px) 480px, 1200px"
      width={width}
      height={height}
      alt={altText}
      loading={eager ? "eager" : "lazy"}
      className={className}
      style={style}
    />
  );
}
