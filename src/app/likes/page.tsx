import { LikesScreen } from "@/components/likes-screen";
import { requireDashboardAuth } from "@/lib/server-auth";

export const metadata = {
  robots: {
    index: false,
    follow: false
  }
};

export default async function LikesPage() {
  await requireDashboardAuth("/likes");
  return <LikesScreen />;
}
