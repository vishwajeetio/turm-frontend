import { PlanManagementScreen } from "@/components/plan-management-screen";
import { requireDashboardAuth } from "@/lib/server-auth";

export const metadata = {
  robots: {
    index: false,
    follow: false
  }
};

export default async function PlanPage() {
  await requireDashboardAuth("/plan");
  return <PlanManagementScreen />;
}
