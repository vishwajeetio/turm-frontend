import { ProfileScreen } from "@/components/profile-screen";
import { requireTenantDashboardAuth } from "@/lib/server-auth";

export const metadata = {
  robots: {
    index: false,
    follow: false
  }
};

export default async function ProfilePage() {
  await requireTenantDashboardAuth("/profile");
  return <ProfileScreen />;
}
