import { MessagesScreen } from "@/components/messages-screen";
import { requireDashboardAuth } from "@/lib/server-auth";

export const metadata = {
  robots: {
    index: false,
    follow: false
  }
};

export default async function MessagesPage() {
  await requireDashboardAuth("/messages");
  return <MessagesScreen />;
}
