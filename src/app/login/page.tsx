import { AuthFlowCard } from "@/components/auth-flow-card";
import { redirectAuthenticatedToDashboard } from "@/lib/server-auth";

export const metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

function normalizeNextParam(nextParam: string | string[] | undefined) {
  if (typeof nextParam !== "string") {
    return "/";
  }
  if (!nextParam.startsWith("/") || nextParam.startsWith("//")) {
    return "/";
  }
  return nextParam;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const resolvedSearchParams = await searchParams;
  const nextPath = normalizeNextParam(resolvedSearchParams.next);
  await redirectAuthenticatedToDashboard(nextPath);

  return (
    <div className="auth-page-shell">
      <AuthFlowCard nextPath={nextPath} />
    </div>
  );
}
