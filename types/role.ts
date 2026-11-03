// S-039: Staff role types.
// StaffRole covers only the two roles the Super Admin can grant/remove.
// 'super_admin' is excluded — it is set only by our team's service-role script.

export type StaffRole = "admin" | "editor";

export interface StaffListItem {
  userId: string;
  email: string;
  role: StaffRole;
  lastSignInAt: string | null;
  hasTotpEnrolled: boolean;
}
