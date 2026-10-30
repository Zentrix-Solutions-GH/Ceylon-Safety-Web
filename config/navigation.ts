import type { MessageKey } from "@/messages/en";

export type NavItem = {
  id: string;
  href: string;
  labelKey: MessageKey;
};

// AC1: fixed nav order — Home → Articles → Documents → Courses → Jobs → Contact Coach.
// Personal items (Sign In, Sign Up, Account, Cart) live in HeaderPersonal, not here.
export const NAV_ITEMS: NavItem[] = [
  { id: "home", href: "/", labelKey: "nav.home" },
  { id: "articles", href: "/articles", labelKey: "nav.articles" },
  { id: "documents", href: "/documents", labelKey: "nav.documents" },
  { id: "courses", href: "/courses", labelKey: "nav.courses" },
  { id: "jobs", href: "/jobs", labelKey: "nav.jobs" },
  { id: "contact-coach", href: "/contact-coach", labelKey: "nav.contact_coach" },
];
