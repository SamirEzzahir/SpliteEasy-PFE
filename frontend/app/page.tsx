import type { Viewport } from "next";
import Link from "next/link";
import { ArrowDownLeft, ArrowRight, Check, ChevronDown, CircleCheck, ReceiptText, ShieldCheck, Users, Utensils, Wallet } from "lucide-react";
import { fmt } from "@/lib/format";
import styles from "./landing.module.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

const benefits = [
  { icon: Users, label: "Split bills" },
  { icon: Wallet, label: "Track spending" },
  { icon: CircleCheck, label: "Settle up" },
];

const steps = [
  { title: "Bring your people", text: "Create a group for your friends, roommates, or next trip." },
  { title: "Add an expense", text: "Enter what you paid and choose how to split it." },
  { title: "Know where you stand", text: "See who owes what and record payments when you settle up." },
];

export default function HomePage() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/" className={styles.brand} aria-label="SplitEasy home">
          <span className={styles.brandMark} aria-hidden="true">$</span>
          <span>Split<em>Easy</em></span>
        </Link>
        <span className={styles.headerNote}>A little less math. A lot more living.</span>
        <span className={styles.welcomeLabel}>Welcome</span>
      </header>

      <div className={styles.welcome}>
        <div className={styles.scrollArea}>
          <section className={styles.hero} aria-labelledby="welcome-title">
            <p className={styles.eyebrow}><Users size={15} aria-hidden="true" /> Better together</p>
            <h1 id="welcome-title">Share expenses.<br /><span>Keep friendships.</span></h1>
            <p className={styles.intro}>
              Trips, rent, dinner with friends. Keep shared spending simple, so you can enjoy the good stuff.
            </p>
            <ul className={styles.benefits} aria-label="What you can do with SplitEasy">
              {benefits.map(({ icon: BenefitIcon, label }) => (
                <li key={label}><BenefitIcon size={17} aria-hidden="true" /><span>{label}</span></li>
              ))}
            </ul>
          </section>

          <figure className={styles.preview} aria-labelledby="preview-caption">
            <div className={styles.previewHeading}>
              <span><ReceiptText size={15} aria-hidden="true" /> One bill. All sorted.</span>
              <span className={styles.exampleLabel}>Example</span>
            </div>
            <div className={`card ${styles.expenseCard}`}>
              <div className={styles.expenseHeading}>
                <span className={styles.expenseIcon}><Utensils size={21} aria-hidden="true" /></span>
                <div><h2>Dinner with friends</h2><p>You paid for 3 people</p></div>
                <span className={styles.expenseCheck}><Check size={17} aria-hidden="true" /><span className="sr-only">Expense added</span></span>
              </div>
              <div className={styles.expenseTotal}>
                <span>Total bill</span><strong>{fmt(360, "MAD")}</strong>
                <p>Split equally. No mental math.</p>
              </div>
              <ul className={styles.shares} aria-label="Each person's share">
                {["You", "Lina", "Omar"].map((name, index) => (
                  <li key={name}>
                    <span className={`${styles.avatar} ${styles[`avatar${index}`]}`} aria-hidden="true">{name[0]}</span>
                    <span>{name}</span><strong>{fmt(120, "MAD")}</strong>
                  </li>
                ))}
              </ul>
              <div className={styles.balance}>
                <ArrowDownLeft size={21} aria-hidden="true" />
                <div><span>You are owed</span><small>From Lina and Omar</small></div>
                <strong>{fmt(240, "MAD")}</strong>
              </div>
            </div>
            <figcaption id="preview-caption"><Check size={14} aria-hidden="true" /> A clear balance for everyone.</figcaption>
          </figure>

          <details className={styles.details}>
            <summary>How SplitEasy works <ChevronDown size={17} aria-hidden="true" /></summary>
            <ol className={styles.steps}>
              {steps.map(({ title, text }, index) => (
                <li key={title}><span aria-hidden="true">{index + 1}</span><div><h2>{title}</h2><p>{text}</p></div></li>
              ))}
            </ol>
            <p className={styles.moneyNote}><Wallet size={18} aria-hidden="true" /><span>Just for you: organize your own wallets and budgets in My Money.</span></p>
          </details>
        </div>

        <div className={styles.actions} role="group" aria-label="Account actions">
          <p className={styles.reassurance}><ShieldCheck size={14} aria-hidden="true" /> Free to get started. No credit card needed.</p>
          <Link href="/signup" className={`btn btn-primary ${styles.startButton}`}>Get started <ArrowRight size={19} aria-hidden="true" /></Link>
          <p className={styles.signIn}>Already have an account? <Link href="/login">Sign in</Link></p>
        </div>
      </div>
    </main>
  );
}
