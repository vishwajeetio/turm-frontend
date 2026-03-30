import { FeedScreen } from "@/components/feed-screen";
import { LandingPage } from "@/components/landing-page";
import { getOptionalDashboardAuth } from "@/lib/server-auth";

export default async function HomePage() {
  const dashboard = await getOptionalDashboardAuth();
  if (dashboard) {
    return <FeedScreen />;
  }
  return <LandingPage />;
}
