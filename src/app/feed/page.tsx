import { FeedScreen } from "@/components/feed-screen";
import { requireDashboardAuth } from "@/lib/server-auth";

export const metadata = {
  robots: {
    index: false,
    follow: false
  }
};

export default async function FeedPage() {
  await requireDashboardAuth("/feed");
  return <FeedScreen />;
}
