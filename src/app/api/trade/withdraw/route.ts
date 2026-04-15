import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-route";

export async function POST() {
  const unauthorized = await requireSession();
  if (unauthorized) return unauthorized;

  return NextResponse.json(
    {
      error:
        "Panel üzerinden ACP v1 withdraw kaldırıldı. Çekim için `acp-cli`, Hyperliquid arayüzü veya doğrudan HL kullanın.",
      code: "HL_V2_NO_PANEL_WITHDRAW",
    },
    { status: 501 }
  );
}
