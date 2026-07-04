import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getAccountInfo } from "@/features/account";
import { MessagesView, getThread } from "@/features/messages";
import styles from "@/features/account/account.module.css";

export const metadata: Metadata = {
  title: "Message your team",
};

export const dynamic = "force-dynamic";

/**
 * "Message Ollie" — the client's two-way thread with their consented care team.
 * A sub-view of The community, so the Community tab stays active. The thread and
 * composer come from the RLS-scoped messages table (client-safe by construction).
 */
export default async function ClientMessagesPage() {
  const account = await getAccountInfo();
  if (!account) redirect("/signin");

  const thread = await getThread();

  return (
    <>
      <Link className={styles.backLink} href="/app/community">
        ← The community
      </Link>

      <div>
        <h1 className={styles.heading}>Message Ollie</h1>
        <p className={styles.subhead}>
          A private line to your team. They read this alongside your programme, so it is a good place
          for questions and how your week is going.
        </p>
      </div>

      <MessagesView thread={thread} />
    </>
  );
}
