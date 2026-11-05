import type { ComponentType, SVGProps } from "react";
import Link from "next/link";
import { Facebook, Instagram, Linkedin, Youtube } from "lucide-react";
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
  return typeof url === "string" && (url.startsWith("https://") || url.startsWith("http://"));
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

const SOCIAL_CONFIGS: {
  settingKey: keyof FooterSettings;
  labelKey: MessageKey;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
}[] = [
  { settingKey: "social_facebook", labelKey: "footer.social.facebook", Icon: Facebook },
  { settingKey: "social_instagram", labelKey: "footer.social.instagram", Icon: Instagram },
  { settingKey: "social_linkedin", labelKey: "footer.social.linkedin", Icon: Linkedin },
  { settingKey: "social_youtube", labelKey: "footer.social.youtube", Icon: Youtube },
];

export default function Footer({ settings, categories = [] }: FooterProps) {
  const year = new Date().getFullYear();

  const socialLinks = SOCIAL_CONFIGS.filter(({ settingKey }) =>
    isSafeUrl(settings?.[settingKey])
  );
  const hasContact =
    settings?.contact_email || settings?.contact_phone || settings?.footer_address;

  return (
    // AC1: role=contentinfo is implicit on <footer>; aria-label distinguishes it from inner sections
    <footer aria-label={t("footer.label")} className="border-t bg-muted/40">
      <div className="container px-4 py-10 md:py-12">
        {/*
          AC3 mobile order: contact → social → quick links → categories → copyright.
          flex-col preserves this order on mobile; md:grid rearranges for desktop.
        */}
        <div className="flex flex-col gap-8 md:grid md:grid-cols-3 md:gap-10">

          {/* Contact details — left out when no settings (EC1, EC2) */}
          {hasContact && (
            <div>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-foreground">
                {t("footer.contact")}
              </h2>
              <ul className="space-y-1.5 text-sm text-muted-foreground">
                {settings?.contact_phone && (
                  <li>{settings.contact_phone}</li>
                )}
                {settings?.contact_email && (
                  // AC6: shown as plain text AND as a mailto link
                  <li>
                    <span>{settings.contact_email}</span>
                    <span aria-hidden={true}> · </span>
                    <a
                      href={`mailto:${settings.contact_email}`}
                      className="underline underline-offset-2 hover:text-foreground"
                    >
                      {t("footer.email_link")}
                    </a>
                  </li>
                )}
                {/* EC3: address wraps at any length up to 300 chars */}
                {settings?.footer_address && (
                  <li className="max-w-xs whitespace-pre-line break-words">
                    {settings.footer_address}
                  </li>
                )}
              </ul>
            </div>
          )}

          {/* Social icons — left out when none are filled or valid (AC2, EC5) */}
          {socialLinks.length > 0 && (
            <div>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-foreground">
                {t("footer.follow")}
              </h2>
              {/* AC2/AC3: icons in one row; 44 px touch targets on phones */}
              <ul className="flex flex-row gap-1">
                {socialLinks.map(({ settingKey, labelKey, Icon }) => (
                  <li key={settingKey}>
                    <a
                      href={settings![settingKey] as string}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={t(labelKey)}
                      className="flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      <Icon className="h-5 w-5" aria-hidden={true} />
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Quick links — always shown (safe footer includes these) */}
          <div>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-foreground">
              {t("footer.quick_links")}
            </h2>
            {/* AC3: two columns on both mobile and desktop */}
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

          {/* Categories — EC4: left out when list is empty or Q69 not settled */}
          {categories.length > 0 && (
            <div>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-foreground">
                {t("footer.categories")}
              </h2>
              <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
                {categories.map((cat) => (
                  <li key={cat.slug}>
                    <Link
                      href={`/articles?category=${cat.slug}`}
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

        {/* AC1/AC3: copyright always shown at the bottom */}
        {/* AC5: uses site.copyright from messages/en.ts */}
        <div className="mt-10 border-t pt-6 text-center text-sm text-muted-foreground">
          &copy; {year} {t("site.copyright")}
        </div>
      </div>
    </footer>
  );
}
