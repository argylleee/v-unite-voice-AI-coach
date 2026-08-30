import { SessionDetailView } from "@/components/sessions/session-detail-view";

export const metadata = { title: "Session · V-Unite" };

export default async function SessionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <SessionDetailView id={id} />;
}
