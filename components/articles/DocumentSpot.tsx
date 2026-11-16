interface DocumentSpotProps {
  slug: string;
  title: string;
  price: number;
  previewUrl?: string;
}

export default function DocumentSpot({ slug, title, price, previewUrl }: DocumentSpotProps) {
  const priceLKR = (price / 100).toLocaleString("en-LK", {
    style: "currency",
    currency: "LKR",
    minimumFractionDigits: 0,
  });

  return (
    <a href={`/documents/${slug}`} data-block="document" className="document-spot">
      {previewUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={previewUrl} alt={title} className="document-spot__thumbnail" />
      )}
      <span className="document-spot__title">{title}</span>
      <span className="document-spot__price">{priceLKR}</span>
    </a>
  );
}
