import Link from "next/link";
import Image from "next/image";

export function TrainerCTA() {
  return (
    <section className="relative overflow-hidden bg-[#1a1a1a] py-16">
      <div className="absolute inset-0">
        <Image
          src="https://images.unsplash.com/photo-1593079831268-3381b0db4a77?w=1600&q=80"
          alt=""
          fill
          className="object-cover object-center opacity-25"
          unoptimized
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#C00000]/90 via-[#8B0000]/80 to-[#4a0000]/70" />
      </div>

      <div className="relative z-10 mx-auto max-w-6xl px-4 text-center">
        <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-white/60">Ceylon Safety Trainers</div>
        <h2 className="mb-3 text-2xl font-black text-white sm:text-3xl">
          Need a Certified Safety Trainer<br className="hidden sm:block" /> for Your Site or Factory?
        </h2>
        <p className="mx-auto mb-7 max-w-lg text-sm text-white/75 leading-relaxed">
          Connect with our network of 1,240+ verified occupational safety trainers.
          We&apos;ll match you with certified professionals for your industry and location across Sri Lanka.
        </p>
        <Link
          href="/contact-coach"
          className="inline-flex items-center rounded-full bg-white px-8 py-3 text-sm font-bold text-[#C00000] hover:bg-gray-100 transition-colors shadow-xl"
        >
          Contact a Trainer →
        </Link>
      </div>
    </section>
  );
}
