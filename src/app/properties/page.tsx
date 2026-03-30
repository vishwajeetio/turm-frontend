import { PropertiesScreen } from "@/components/properties-screen";
import { requireListerDashboardAuth } from "@/lib/server-auth";

export const metadata = {
  robots: {
    index: false,
    follow: false
  }
};

export default async function PropertiesPage() {
  await requireListerDashboardAuth("/properties");
  return <PropertiesScreen />;
}
