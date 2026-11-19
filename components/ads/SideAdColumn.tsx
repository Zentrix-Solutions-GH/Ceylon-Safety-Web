import { getAdsSettings } from "@/lib/settings/ads";
import { AdUnit } from "@/components/ads/AdUnit";

interface SideAdColumnProps {
  side: "left" | "right";
}

const isDev = process.env.NODE_ENV === "development";

export async function SideAdColumn({ side }: SideAdColumnProps) {
  const ads = await getAdsSettings();
  const slot = side === "left" ? ads.slotSidebarLeft : ads.slotSidebarRight;

  if (isDev) {
    return (
      <div className="flex h-[600px] w-[160px] flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 bg-gray-50">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">
          Ad space
        </p>
        <p className="mt-1 text-[9px] text-gray-300">{side} column</p>
      </div>
    );
  }

  if (!ads.enabled || !ads.clientId || !slot) {
    return null;
  }

  return (
    <div className="sticky top-20 bottom-0">
      <AdUnit clientId={ads.clientId} slot={slot} />
    </div>
  );
}
