import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { t } from "@/messages/en";
import type { MessageKey } from "@/messages/en";

export interface FooterSettings {
  contact_email?: string | null;
  contact_phone?: string | null;
  footer_address?: string | null;
  social_facebook?: string | null;
  social_instagram?: string | null;
  social_linkedin?: string | null;
  social_youtube?: string | null;
}

export interface FooterCategory {
  name: string;
  slug: string;
}

interface FooterProps {
  settings?: FooterSettings | null;
  categories?: FooterCategory[];
}

function isSafeUrl(url: string | null | undefined): url is string {
  return typeof url === "string" && url.startsWith("https://");
}

const QUICK_LINKS: { key: MessageKey; href: string }[] = [
  { key: "nav.home", href: "/" },
  { key: "nav.articles", href: "/articles" },
  { key: "nav.documents", href: "/documents" },
  { key: "nav.courses", href: "/courses" },
  { key: "nav.jobs", href: "/jobs" },
  { key: "nav.contact_coach", href: "/contact-coach" },
  { key: "footer.terms", href: "/terms" },
  { key: "footer.privacy", href: "/privacy" },
  { key: "footer.refund_policy", href: "/refund-policy" },
  { key: "footer.disclaimer", href: "/disclaimer" },
];

const SOCIAL_SETTINGS: { settingKey: keyof FooterSettings; labelKey: MessageKey }[] = [
  { settingKey: "social_facebook", labelKey: "footer.social.facebook" },
  { settingKey: "social_instagram", labelKey: "footer.social.instagram" },
  { settingKey: "social_linkedin", labelKey: "footer.social.linkedin" },
  { settingKey: "social_youtube", labelKey: "footer.social.youtube" },
];

export default function Footer({ settings, categories = [] }: FooterProps) {
  const year = new Date().getFullYear();

  const socialLinks = SOCIAL_SETTINGS.flatMap(({ settingKey, labelKey }) => {
    const url = settings?.[settingKey];
    return isSafeUrl(url) ? [{ settingKey, labelKey, url }] : [];
  });
  const hasContact =
    settings?.contact_email || settings?.contact_phone || settings?.footer_address;

  return (
    <footer aria-label={t("footer.label")} className="border-t bg-muted/40">
      <div className="container px-4 py-10 md:py-12">
        <div className="flex flex-col gap-8 md:grid md:grid-cols-3 md:gap-10">
          {hasContact && (
            <div>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-foreground">
                {t("footer.contact")}
              </h3>
              <ul className="space-y-1.5 text-sm text-muted-foreground">
                {settings?.contact_phone && (
                  <li>{settings.contact_phone}</li>
                )}
                {settings?.contact_email && (
                  <li>
                    <span>{settings.contact_email}</span>
                    <span aria-hidden={true}> &middot; </span>
                    <a
                      href={`mailto:${settings.contact_email.split("?")[0]}`}
                      className="underline underline-offset-2 hover:text-foreground"
                    >
                      {t("footer.email_link")}
                    </a>
                  </li>
                )}
                {settings?.footer_address && (
                  <li className="max-w-xs whitespace-pre-line break-words">
                    {settings.footer_address}
                  </li>
                )}
              </ul>
            </div>
          )}
          {socialLinks.length > 0 && (
            <div>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-foreground">
                {t("footer.follow")}
              </h3>
              <ul className="flex flex-row gap-1">
                {socialLinks.map(({ settingKey, labelKey, url }) => (
                  <li key={settingKey}>
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={t(labelKey)}
                      className="flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      <ExternalLink className="h-5 w-5" aria-hidden={true} />
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-foreground">
              {t("footer.quick_links")}
            </h3>
            <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
              {QUICK_LINKS.map(({ key, href }) => (
                <li key={href}>
                  <Link href={href} className="hover:text-foreground hover:underline">
                    {t(key)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          {categories.length > 0 && (
            <div>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-foreground">
                {t("footer.categories")}
              </h3>
              <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
                {categories.map((cat) => (
                  <li key={cat.slug}>
                    <Link
                      href={`/articles?category=${encodeURIComponent(cat.slug)}`}
                      className="hover:text-foreground hover:underline"
                    >
                      {cat.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <div className="mt-10 border-t pt-6 text-center text-sm text-muted-foreground">
          &copy; {year} {t("site.copyright")}
        </div>
      </div>
    </footer>
  );
}
