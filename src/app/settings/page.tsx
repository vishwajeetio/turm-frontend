import { SettingsScreen } from "@/components/settings-screen";
import { requireDashboardAuth } from "@/lib/server-auth";

export const metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default async function SettingsPage() {
  await requireDashboardAuth("/settings");
  return <SettingsScreen />;
}
