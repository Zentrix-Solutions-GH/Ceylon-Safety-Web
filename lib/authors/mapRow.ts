import type { Author } from "@/types/author";

export function mapRow(row: Record<string, unknown>): Author {
  return {
    id: row.id as string,
    name: row.name as string,
    slug: row.slug as string,
    bio: (row.bio as string | null) ?? null,
    isActive: row.is_active as boolean,
    updatedAt: row.updated_at as string,
  };
}
