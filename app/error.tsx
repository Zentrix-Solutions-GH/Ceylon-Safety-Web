"use client";
// AC7: friendly error page — heading, Try again, Home link. No technical detail.
// Wraps ErrorPage in <main id="main-content"> so the root layout's skip link
// has a valid target when this boundary fires above all route-group layouts.
import { ErrorPage } from "@/components/shared/ErrorPage";
export default function RootError(props: Parameters<typeof ErrorPage>[0]) {
  return <main id="main-content" tabIndex={-1}><ErrorPage {...props} /></main>;
}
