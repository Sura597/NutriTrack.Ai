import type { Metadata } from "next";
import { requireOnboardedUser } from "@/lib/data/session";
import { FoodsExplorer } from "@/components/foods/foods-explorer";

export const metadata: Metadata = { title: "Affordable Foods" };

export default async function FoodsPage() {
  const { profile } = await requireOnboardedUser();
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold">Eat healthy on a budget</h1>
        <p className="text-sm text-muted-foreground">
          Ideas that suit your diet and allergies, ranked by protein for the price. Costs are rough estimates in ₹.
        </p>
      </div>
      <FoodsExplorer initialAdjustment={profile.price_adjustment_pct} />
    </div>
  );
}
