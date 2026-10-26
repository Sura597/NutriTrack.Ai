import { requireOnboardedUser } from "@/lib/data/session";
import { APP_NAME } from "@/lib/format";
import { AppFrame } from "@/components/app/app-frame";
import { todayIn } from "@/lib/dates";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { settings } = await requireOnboardedUser();
  return (
    <AppFrame appName={APP_NAME} today={todayIn(settings.time_zone)}>
      {children}
    </AppFrame>
  );
}
