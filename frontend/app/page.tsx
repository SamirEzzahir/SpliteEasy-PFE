import Link from "next/link";
import { ArrowRight, BarChart3, Check, CircleDollarSign, PieChart, ReceiptText, ShieldCheck, Sparkles, Users, Wallet } from "lucide-react";
import styles from "./landing.module.css";

const features = [
  { icon: Users, title: "Split expenses together", text: "Create groups for trips, homes, or events and divide every expense fairly.", tone: "purple" },
  { icon: Wallet, title: "Give every dirham a job", text: "Build better habits with smart money jars for needs, savings, fun, and more.", tone: "green" },
  { icon: CircleDollarSign, title: "Settle without the stress", text: "See exactly who owes whom and clear balances with simple, transparent payments.", tone: "orange" },
];
const steps = [["01", "Create your circle", "Invite friends, family, roommates, or travel partners."], ["02", "Add what you spend", "Log an expense and choose how you want to split it."], ["03", "Stay effortlessly even", "SplitEasy keeps the math, balances, and history in sync."]];

export default function HomePage() {
  return <main className={styles.page}>
    <nav className={styles.nav} aria-label="Main navigation">
      <Link href="/" className={styles.brand} aria-label="SplitEasy home"><span className={styles.brandMark}>$</span><span>Split<em>Easy</em></span></Link>
      <div className={styles.navLinks}><a href="#features">Features</a><a href="#how-it-works">How it works</a><a href="#security">Security</a></div>
      <div className={styles.navActions}><Link href="/login" className={styles.signIn}>Sign in</Link><Link href="/signup" className={styles.navCta}>Get started <ArrowRight size={15}/></Link></div>
    </nav>
    <section className={styles.hero}><div className={styles.heroGlow}/><div className={styles.heroCopy}>
      <div className={styles.eyebrow}><Sparkles size={15}/> Money together, made simple</div><h1>Share expenses.<br/><span>Keep friendships.</span></h1>
      <p>Split bills, track shared spending, and organize your money in one calm place. No awkward maths. No forgotten payments.</p>
      <div className={styles.heroActions}><Link href="/signup" className={styles.primaryCta}>Start for free <ArrowRight size={18}/></Link><Link href="/login" className={styles.secondaryCta}>Explore the demo</Link></div>
      <div className={styles.reassurance}><span><Check size={14}/> Free to get started</span><span><Check size={14}/> No credit card</span></div>
    </div><div className={styles.productWrap} aria-label="SplitEasy dashboard preview">
      <div className={styles.floatingBadge}><span>✓</span><div><b>All settled up!</b><small>Weekend trip</small></div></div>
      <div className={styles.product}><div className={styles.productSide}><div className={styles.miniBrand}>$</div>{["▦","♙","◇","◎","◌"].map((item,i)=><span className={i===0?styles.activeIcon:""} key={item}>{item}</span>)}</div>
      <div className={styles.productMain}><div className={styles.productTop}><div><small>GOOD MORNING, ALEX</small><b>Here&apos;s your money overview</b></div><span>AM</span></div>
      <div className={styles.statGrid}><div><small>Total balance</small><strong>4,820 <i>MAD</i></strong><em>+12.5% this month</em></div><div><small>You are owed</small><strong className={styles.greenText}>860 <i>MAD</i></strong><em>From 3 friends</em></div><div><small>You owe</small><strong className={styles.orangeText}>245 <i>MAD</i></strong><em>Across 2 groups</em></div></div>
      <div className={styles.chartRow}><div className={styles.chartCard}><div className={styles.cardTitle}><span><BarChart3 size={14}/> Monthly spending</span><small>Last 6 months</small></div><div className={styles.chart}>{[42,65,48,78,58,88].map((height,i)=><i key={i} style={{height:`${height}%`}}/>)}</div><div className={styles.months}>{["Mar","Apr","May","Jun","Jul","Aug"].map(m=><span key={m}>{m}</span>)}</div></div>
      <div className={styles.jarCard}><div className={styles.cardTitle}><span><PieChart size={14}/> Your jars</span></div><div className={styles.donut}><span>68%<small>allocated</small></span></div><div className={styles.legend}><span><i/> Necessities</span><span><i/> Savings</span><span><i/> Fun</span></div></div></div>
      <div className={styles.activityCard}><div className={styles.cardTitle}><span><ReceiptText size={14}/> Recent activity</span><b>View all</b></div><div className={styles.activity}><span>🍜</span><div><b>Dinner at Nori</b><small>Tokyo trip · Paid by you</small></div><strong>− 320 MAD</strong></div><div className={styles.activity}><span>🏠</span><div><b>August rent</b><small>Roommates · Paid by Lina</small></div><strong>− 1,400 MAD</strong></div></div></div></div>
      <div className={styles.floatingTotal}><small>Saved this month</small><b>+ 1,240 MAD</b><span>↗ 18%</span></div>
    </div></section>
    <section className={styles.trustStrip}><p>One simple home for all the ways you share money</p><div><span>✈ Travel groups</span><span>⌂ Roommates</span><span>♧ Couples</span><span>☆ Friends</span><span>◇ Families</span></div></section>
    <section className={styles.section} id="features"><div className={styles.sectionHeading}><span>Everything you need</span><h2>Less time tracking.<br/>More time living.</h2><p>From one coffee to an entire holiday, SplitEasy makes shared money feel effortless.</p></div><div className={styles.featureGrid}>{features.map(({icon:FeatureIcon,title,text,tone})=><article className={styles.featureCard} key={title}><div className={`${styles.featureIcon} ${styles[tone]}`}><FeatureIcon size={22}/></div><h3>{title}</h3><p>{text}</p><Link href="/signup">Learn more <ArrowRight size={14}/></Link></article>)}</div></section>
    <section className={styles.stepsSection} id="how-it-works"><div className={styles.stepsIntro}><span>How it works</span><h2>From expense to even<br/>in three easy steps.</h2><p>We handle the calculations behind the scenes, so your group can focus on the moments that matter.</p></div><div className={styles.steps}>{steps.map(([number,title,text])=><div className={styles.step} key={number}><b>{number}</b><div><h3>{title}</h3><p>{text}</p></div></div>)}</div></section>
    <section className={styles.security} id="security"><div className={styles.securityIcon}><ShieldCheck size={30}/></div><div><span>Built for peace of mind</span><h2>Your money story stays yours.</h2><p>Clear records, private groups, and secure account access give you confidence in every shared expense.</p></div><div className={styles.securityPoints}><span><Check size={16}/> Private by default</span><span><Check size={16}/> Transparent history</span><span><Check size={16}/> Secure authentication</span></div></section>
    <section className={styles.finalCta}><div><span>Ready when you are</span><h2>Make money the easy part.</h2><p>Join SplitEasy and start sharing expenses without sharing the stress.</p></div><Link href="/signup">Create your free account <ArrowRight size={18}/></Link></section>
    <footer className={styles.footer}><div className={styles.brand}><span className={styles.brandMark}>$</span><span>Split<em>Easy</em></span></div><p>Smarter shared spending, happier groups.</p><div><Link href="/login">Sign in</Link><Link href="/signup">Get started</Link></div><small>© {new Date().getFullYear()} SplitEasy. All rights reserved.</small></footer>
  </main>;
}
