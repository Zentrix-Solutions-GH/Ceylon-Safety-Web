import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import Footer, { type FooterSettings, type FooterCategory } from "@/components/layout/Footer";

const FULL_SETTINGS: FooterSettings = {
  contact_email: "info@example.com",
  contact_phone: "+94 11 234 5678",
  footer_address: "123 Main Street\nColombo 01",
  social_facebook: "https://facebook.com/ceylonsafety",
  social_instagram: "https://instagram.com/ceylonsafety",
  social_linkedin: "https://linkedin.com/company/ceylonsafety",
  social_youtube: "https://youtube.com/@ceylonsafety",
};

const CATEGORIES: FooterCategory[] = [
  { name: "Fire Safety", slug: "fire-safety" },
  { name: "Construction", slug: "construction" },
];

describe("Footer quick links", () => {
  it("renders all 10 quick links", () => {
    render(<Footer />);
    const links = ["Home", "Articles", "Documents", "Courses", "Jobs",
      "Contact Coach", "Terms", "Privacy", "Refund policy", "Disclaimer"];
    for (const label of links) {
      expect(screen.getByRole("link", { name: label })).toBeInTheDocument();
    }
  });

  it("Home link points to /", () => {
    render(<Footer />);
    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute("href", "/");
  });
});

describe("Footer copyright", () => {
  it("shows copyright with current year and CeylonSafety", () => {
    render(<Footer />);
    const year = new Date().getFullYear().toString();
    expect(screen.getByText(new RegExp(year))).toBeInTheDocument();
    expect(screen.getByText(/CeylonSafety/)).toBeInTheDocument();
  });
});

describe("Footer safe mode (no settings)", () => {
  it("renders quick links and copyright without contact or social sections", () => {
    render(<Footer />);
    expect(screen.queryByText("Contact")).toBeNull();
    expect(screen.queryByText("Follow us")).toBeNull();
    expect(screen.getByText("Quick links")).toBeInTheDocument();
  });

  it("renders without throwing when settings is null", () => {
    expect(() => render(<Footer settings={null} />)).not.toThrow();
  });
});

describe("Footer contact details", () => {
  it("shows contact block when settings provided", () => {
    render(<Footer settings={FULL_SETTINGS} />);
    expect(screen.getByText("Contact")).toBeInTheDocument();
    expect(screen.getByText("+94 11 234 5678")).toBeInTheDocument();
    expect(screen.getByText("info@example.com")).toBeInTheDocument();
  });

  it("hides contact block when all contact fields are empty", () => {
    render(<Footer settings={{ social_facebook: "https://facebook.com/x" }} />);
    expect(screen.queryByText("Contact")).toBeNull();
  });

  it("omits phone line when contact_phone is null", () => {
    render(<Footer settings={{ contact_email: "hi@example.com" }} />);
    expect(screen.queryByText("+94")).toBeNull();
  });

  it("omits email line when contact_email is null", () => {
    render(<Footer settings={{ contact_phone: "+94 11 000 0000" }} />);
    expect(screen.queryByRole("link", { name: "Email us" })).toBeNull();
  });
});

describe("Footer email link (AC6)", () => {
  it("renders a mailto link for contact_email", () => {
    render(<Footer settings={FULL_SETTINGS} />);
    const mailtoLink = screen.getByRole("link", { name: "Email us" });
    expect(mailtoLink).toHaveAttribute("href", "mailto:info@example.com");
  });

  it("renders email as plain text in addition to the mailto link", () => {
    render(<Footer settings={FULL_SETTINGS} />);
    expect(screen.getByText("info@example.com")).toBeInTheDocument();
  });
});

describe("Footer address (EC3)", () => {
  it("renders a 300-character address without crashing", () => {
    const longAddress = "A".repeat(300);
    expect(() =>
      render(<Footer settings={{ footer_address: longAddress }} />)
    ).not.toThrow();
  });
});

describe("Footer social links (AC2, EC5)", () => {
  it("renders social icons when settings are filled", () => {
    render(<Footer settings={FULL_SETTINGS} />);
    expect(screen.getByRole("link", { name: "Facebook" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Instagram" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "LinkedIn" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "YouTube" })).toBeInTheDocument();
  });

  it("social links open in a new tab with rel=noopener noreferrer", () => {
    render(<Footer settings={FULL_SETTINGS} />);
    const fb = screen.getByRole("link", { name: "Facebook" });
    expect(fb).toHaveAttribute("target", "_blank");
    expect(fb).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("social link points to the correct URL", () => {
    render(<Footer settings={FULL_SETTINGS} />);
    expect(screen.getByRole("link", { name: "YouTube" })).toHaveAttribute(
      "href",
      "https://youtube.com/@ceylonsafety"
    );
  });

  it("hides social link when value is not a safe URL (EC5)", () => {
    render(<Footer settings={{ social_facebook: "javascript:alert(1)" }} />);
    expect(screen.queryByRole("link", { name: "Facebook" })).toBeNull();
  });

  it("hides social link when value uses http:// (EC5 — https only)", () => {
    render(<Footer settings={{ social_facebook: "http://facebook.com/x" }} />);
    expect(screen.queryByRole("link", { name: "Facebook" })).toBeNull();
  });

  it("hides social link when value is empty", () => {
    render(<Footer settings={{ social_instagram: "" }} />);
    expect(screen.queryByRole("link", { name: "Instagram" })).toBeNull();
  });

  it("hides 'Follow us' heading when no social links are valid", () => {
    render(<Footer settings={{ contact_email: "x@x.com" }} />);
    expect(screen.queryByText("Follow us")).toBeNull();
  });

  it("renders only filled social links (partial settings)", () => {
    render(<Footer settings={{ social_youtube: "https://youtube.com/@cs" }} />);
    expect(screen.getByRole("link", { name: "YouTube" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Facebook" })).toBeNull();
  });
});

describe("Footer categories (EC4)", () => {
  it("renders categories when list is non-empty", () => {
    render(<Footer categories={CATEGORIES} />);
    expect(screen.getByText("Categories")).toBeInTheDocument();
    const fsLink = screen.getByRole("link", { name: "Fire Safety" });
    expect(fsLink).toHaveAttribute("href", "/articles?category=fire-safety");
  });

  it("omits categories block when list is empty (default)", () => {
    render(<Footer />);
    expect(screen.queryByText("Categories")).toBeNull();
  });

  it("omits categories block when empty array passed explicitly", () => {
    render(<Footer categories={[]} />);
    expect(screen.queryByText("Categories")).toBeNull();
  });
});

describe("Footer landmark (AC5)", () => {
  it("renders a contentinfo landmark", () => {
    render(<Footer />);
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
  });
});