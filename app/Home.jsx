"use client";

import Link from "next/link";
import styles from "./page.module.css";

export default function Home() {
    return (
        <div className={styles.page}>
            <main className={styles.main}>
                <h1>Email Dashboard</h1>
                <p>Select an action below:</p>

                <nav className={styles.ctas}>
                    <Link href="/emails" className={styles.primary}>
                        Manage Emails
                    </Link>
                    <Link href="/emails/email-send" className={styles.secondary}>
                        Send Emails
                    </Link>
                    <Link href="/emails/email-status" className={styles.secondary}>
                        Track Emails
                    </Link>


                </nav>
            </main>
        </div>
    );
}
