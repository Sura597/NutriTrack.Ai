"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLogFood } from "@/components/app/log-food-context";
import type { MealType } from "@/lib/nutrition/aggregate";

export function LogFoodButton({
  date, mealType, label = "Log Food", variant = "default", size = "lg", className,
}: {
  date?: string; mealType?: MealType; label?: string; variant?: "default" | "outline" | "soft" | "ghost"; size?: "default" | "sm" | "lg"; className?: string;
}) {
  const { openLog } = useLogFood();
  return (
    <Button variant={variant} size={size} className={className} onClick={() => openLog({ date, mealType })}>
      <Plus /> {label}
    </Button>
  );
}
