"use client";
import RequireAuth from "@/components/RequireAuth";
import MoneyPage from "@/components/money/MoneyPage";
import "./money.css";
export default function MoneyRoute({params}:{params:{view?:string[]}}) {
  return <RequireAuth><MoneyPage view={params.view || []}/></RequireAuth>;
}
