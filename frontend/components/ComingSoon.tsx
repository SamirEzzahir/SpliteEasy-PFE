"use client";
// components/ComingSoon.tsx — placeholder for routes that don't have a full page yet

import Icon from "@/components/Icon";

export default function ComingSoon({ title }: { title: string }) {
  return (
    <>
      <div className="page-head">
        <div>
          <h1>{title}</h1>
          <p>Coming soon.</p>
        </div>
      </div>
      <div className="coming-soon">
        <div className="ic"><Icon name="sparkle" size={36} /></div>
        <h3>This page is on the way</h3>
        <p>
          We&apos;re building this section. In the meantime, head to Jars, Expenses, Groups, or Friends.
        </p>
      </div>
    </>
  );
}
