import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cookieName, verifySessionToken } from "@/lib/session";
import { Dashboard } from "@/components/Dashboard";

export default async function Home() {
  const c = await cookies();
  if (!verifySessionToken(c.get(cookieName())?.value)) {
    redirect("/login");
  }
  return <Dashboard />;
}
