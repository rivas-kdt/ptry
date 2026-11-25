import Image from "next/image";
import { cn } from "@/lib/utils";
import { gradientFor, sourceImageUrl } from "@/lib/images";

/** Fills its (relatively positioned) parent with a photo, or a gradient when there is none. */
export function CoverImage({
  src,
  alt,
  seed,
  sizes,
  priority,
  className,
}: {
  src: string | null | undefined;
  alt: string;
  seed: string;
  sizes: string;
  priority?: boolean;
  className?: string;
}) {
  if (!src) {
    return <div aria-hidden className={cn("absolute inset-0", gradientFor(seed), className)} />;
  }
  return (
    <Image
      src={sourceImageUrl(src)}
      alt={alt}
      fill
      sizes={sizes}
      priority={priority}
      className={cn("object-cover", className)}
    />
  );
}
