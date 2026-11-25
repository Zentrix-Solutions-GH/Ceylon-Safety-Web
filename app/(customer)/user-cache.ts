import { cache } from "react";
import { getCurrentUser } from "@/lib/auth/server";

export const getCurrentUserCached = cache(getCurrentUser);
