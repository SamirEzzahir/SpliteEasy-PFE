"use client";
// components/jars/JarsView.tsx — dispatcher

import CardsView from "./CardsView";
import StackedView from "./StackedView";
import IllustratedView from "./IllustratedView";
import TreemapView from "./TreemapView";
import type { Jar } from "@/lib/types";

export type VizStyle = "cards" | "stacked" | "illustrated" | "treemap";

interface Props {
  style: VizStyle;
  jars: Jar[];
  totals: { income: number };
  onJarClick?: (jar: Jar) => void;
}

export default function JarsView({ style, ...rest }: Props) {
  if (style === "stacked") return <StackedView {...rest} />;
  if (style === "illustrated") return <IllustratedView {...rest} />;
  if (style === "treemap") return <TreemapView {...rest} />;
  return <CardsView {...rest} />;
}
