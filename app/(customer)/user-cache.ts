import { cache } from "react";
import { getCurrentUser } from "@/lib/auth/server";
import { getCartCount } from "@/lib/cart/count";

export const getCurrentUserCached = cache(getCurrentUser);
export const getCartCountCached = cache(getCartCount);
