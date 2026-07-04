import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Sidebar, getRoster } from "@/features/console";
import { InvitesView, getInvites, getAccountRequests } from "@/features/invites";
import { createClient } from "@/lib/supabase/server";
import consoleStyles from "@/features/console/console.module.css";

export const metadata: Metadata = {
  title: "Invitations",
};

export const dynamic = "force-dynamic";

/**
 * Invitations for the clinical team: send signed invite links (the only way
 * an account is created), follow up create-account requests, and track the
 * invitations already sent. Consultants and admins can invite colleagues;
 * every clinical role can invite a client into their care.
 */
export default async function InvitesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signin");
  const viewerName =
    (user.user_metadata?.full_name as string | undefined) ?? user.email ?? "Clinical team";
  const role = user.app_metadata?.role as string | undefined;
  const allowedRoles =
    role === "consultant" || role === "admin"
      ? ["client", "consultant", "nurse", "cep", "physio"]
      : ["client"];

  const [roster, invites, requests] = await Promise.all([
    getRoster(),
    getInvites(),
    getAccountRequests(),
  ]);

  return (
    <div className={consoleStyles.shell}>
      <Sidebar roster={roster} viewerName={viewerName} activeNav="invites" />
      <main className={consoleStyles.main}>
        <InvitesView invites={invites} requests={requests} allowedRoles={allowedRoles} />
      </main>
    </div>
  );
}
