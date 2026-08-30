import Image from "next/image";

import { PEOPLE, type Instructor } from "@/lib/content";

function ProfilePicture({ name, image }: Pick<Instructor, "name" | "image">) {
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2);

  return (
    <div className="relative size-11 shrink-0 overflow-hidden rounded-full border border-white/15 bg-white/[0.06]">
      {image ? (
        <Image
          src={image}
          alt=""
          fill
          sizes="44px"
          className="object-cover"
        />
      ) : (
        <div
          aria-hidden
          className="flex size-full items-center justify-center font-mono text-[10px] tracking-[0.08em] text-white/55 uppercase"
        >
          {initials}
        </div>
      )}
    </div>
  );
}

export function Instructors() {
  return (
    <section
      id="instructors"
      aria-label="Instructors"
      className="mt-14 sm:mt-18"
      data-reveal
    >
      <p className="text-base leading-snug font-medium tracking-[-0.01em] text-white/60 sm:text-lg">
        Our instructors
      </p>

      <div className="mt-7 grid gap-x-8 gap-y-7 sm:grid-cols-2 lg:grid-cols-4">
        {PEOPLE.map(({ name, bio, github, image }) => (
          <article key={name} className="flex gap-3.5">
            <ProfilePicture name={name} image={image} />
            <div className="min-w-0">
              <h2 className="text-[15px] leading-tight font-medium tracking-[-0.015em] text-white">
                {name}
              </h2>
              <a
                href={github}
                target="_blank"
                rel="noreferrer"
                className="mt-1 block truncate text-[12px] leading-snug text-white/40 transition-colors hover:text-white/70"
              >
                {github.replace("https://", "")}
              </a>
              <p className="mt-2 text-[13px] leading-[1.5] text-white/55">
                {bio}
              </p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
