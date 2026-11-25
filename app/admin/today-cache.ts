import { cache } from "react";
import { getAdminToday } from "@/lib/admin/today";

// React cache() deduplicates concurrent calls within one request render.
// Both app/admin/layout.tsx and app/admin/page.tsx import this wrapper
// so layout + page share one result per request.
export const getAdminTodayCached = cache(getAdminToday);
