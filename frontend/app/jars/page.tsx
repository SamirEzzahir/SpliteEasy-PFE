import {redirect} from "next/navigation";

// Preserve bookmarked jar URLs while using the integrated, live budget view.
export default function JarsPage() {
  redirect("/money/budgets");
}
