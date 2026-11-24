/** Minimal HTML escaping for values interpolated into email HTML. */
export function escHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
