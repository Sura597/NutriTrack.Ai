import { requireOnboardedUser } from "@/lib/data/session";
import { APP_NAME } from "@/lib/format";
import { AppFrame } from "@/components/app/app-frame";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { profile, settings } = await requireOnboardedUser();
  return (
    <AppFrame appName={APP_NAME} userName={profile.display_name ?? "You"} timeZone={settings.time_zone}>
      {children}
    </AppFrame>
  );
}
