"use client";
import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { Dialog } from "@/components/ui/dialog";
import Icon from "@/components/Icon";

const moreLinks = [
  ["Friends", "friends", "/friends"], ["Settlements", "settle", "/settlements"],
  ["Balances", "coin", "/balances"], ["Activity", "activity", "/activity"],
  ["Settings", "settings", "/settings"], ["Support", "info", "/support"],
];
export default function MobileBottomNav({ onAddExpense, onCreateGroup }: { onAddExpense: () => void; onCreateGroup: () => void }) {
  const pathname = usePathname();
  const [panel, setPanel] = useState<"actions" | "more" | null>(null);
  const active = (href: string) => pathname === href || pathname.startsWith(href + "/");
  const navLink = (label: string, icon: string, href: string) => <Link href={href} key={href} className={`mob-nav-item${active(href) ? " active" : ""}`} aria-current={active(href) ? "page" : undefined}><Icon name={icon} size={20} /><span>{label}</span></Link>;
  return <>
    <nav className="app-mobile-nav" aria-label="Primary navigation">
      {navLink("Home", "home", "/dashboard")}{navLink("Groups", "groups", "/groups")}
      <div className="mob-fab-wrap"><button className="mob-fab" aria-label="Quick actions" aria-haspopup="dialog" onClick={() => setPanel("actions")}><Icon name="plus" size={26} /></button></div>
      {navLink("Expenses", "expense", "/expenses")}
      <button className={`mob-nav-item${moreLinks.some(([, , href]) => active(href)) ? " active" : ""}`} aria-haspopup="dialog" onClick={() => setPanel("more")}><Icon name="dots" size={20} /><span>More</span></button>
    </nav>
    <Dialog open={panel !== null} onClose={() => setPanel(null)} title={panel === "actions" ? "Quick actions" : "More"}>
      <div className="mobile-menu-links">{panel === "actions" ? <>
        <button onClick={() => { setPanel(null); onAddExpense(); }}><Icon name="expense" size={20} />Add expense</button>
        <button onClick={() => { setPanel(null); onCreateGroup(); }}><Icon name="groups" size={20} />Create group</button>
        <Link href="/settlements" onClick={() => setPanel(null)}><Icon name="settle" size={20} />Record a payment</Link>
      </> : moreLinks.map(([label, icon, href]) => <Link key={href} href={href} aria-current={active(href) ? "page" : undefined} onClick={() => setPanel(null)}><Icon name={icon} size={20} />{label}</Link>)}</div>
    </Dialog>
  </>;
}
