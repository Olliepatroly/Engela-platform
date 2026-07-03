import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ClientSessionView, getOwnClient, getSessionDetail } from "@/features/programs";
import styles from "@/features/account/account.module.css";

export const metadata: Metadata = {
  title: "Your session",
};

export const dynamic = "force-dynamic";

/**
 * One session: what it includes, marking each part done (cardiovascular,
 * resistance and mobility complete separately) and the muscles it works.
 * RLS only returns the session if it belongs to the signed-in client.
 */
export default async function ClientSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;

  const own = await getOwnClient();
  if (!own) redirect("/signin");

  const detail = await getSessionDetail(sessionId);
  if (!detail || detail.clientId !== own.clientId) notFound();

  return (
    <main className={styles.clientMain}>
      <header className={styles.clientHeader}>
        <Link className={styles.backLink} href="/app/program">
          ← Your programme
        </Link>
        <Link className={styles.backLink} href="/app">
          This week
        </Link>
      </header>

      <ClientSessionView detail={detail} figure={own.bodyMap} />
    </main>
  );
}
