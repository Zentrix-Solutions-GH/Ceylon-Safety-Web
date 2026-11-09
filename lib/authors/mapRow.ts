import type { Author } from "@/types/author";
import type { Tables } from "@/types/database";

// All three action queries select only these 6 columns; using Pick keeps the
// signature aligned with what Supabase actually returns.
export type AuthorRow = Pick<Tables<"authors">, "id" | "name" | "slug" | "bio" | "is_active" | "updated_at">;

export function mapRow(row: AuthorRow): Author {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    bio: row.bio ?? null,
    isActive: row.is_active,
    updatedAt: row.updated_at,
  };
}
