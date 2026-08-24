import { renderMarkImage } from "@/lib/logoMarkImage";

const ALLOWED_SIZES = [192, 512] as const;
type AllowedSize = (typeof ALLOWED_SIZES)[number];

export async function GET(_request: Request, { params }: { params: { size: string } }) {
  const size = Number(params.size);
  if (!ALLOWED_SIZES.includes(size as AllowedSize)) {
    return new Response("Not found", { status: 404 });
  }
  return renderMarkImage({ size });
}
