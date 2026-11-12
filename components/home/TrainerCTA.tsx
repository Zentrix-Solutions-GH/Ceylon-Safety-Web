import Link from "next/link";
import Image from "next/image";
import { t } from "@/messages/en";
import { publicConfig } from "@/lib/config.public";

export function TrainerCTA() {
  return (
    <section className="relative overflow-hidden bg-surface-dark py-16">
      <div className="absolute inset-0">
        <Image
          src={`${publicConfig.mediaCdnUrl}/home/trainer-cta-bg.jpg`}
          alt=""
          fill
          className="object-cover object-center opacity-25"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-primary/90 via-primary-darker/80 to-primary-deepest/70" />
      </div>

      <div className="relative z-10 mx-auto max-w-6xl px-4 text-center">
        <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-white/60">{t("home.trainer_cta.eyebrow")}</div>
        <h2 className="mb-3 text-2xl font-black text-white sm:text-3xl">
          {t("home.trainer_cta.heading")}
        </h2>
        <p className="mx-auto mb-7 max-w-lg text-sm text-white/75 leading-relaxed">
          {t("home.trainer_cta.body")}
        </p>
        <Link
          href="/contact-coach"
          className="inline-flex items-center rounded-full bg-white px-8 py-3 text-sm font-bold text-primary hover:bg-gray-100 transition-colors shadow-xl"
        >
          {t("home.trainer_cta.cta")}
        </Link>
      </div>
    </section>
  );
}
