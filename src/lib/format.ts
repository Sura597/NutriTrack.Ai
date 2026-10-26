const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});
const inr2 = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export const formatINR = (n: number, decimals = false) => (decimals ? inr2 : inr).format(n);

export const formatKcal = (n: number) => `${Math.round(n).toLocaleString("en-IN")} kcal`;

export const formatGrams = (n: number) => `${Math.round(n * 10) / 10} g`;

export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "NutriTrack AI";
