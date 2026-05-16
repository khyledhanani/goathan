import { GroupPage } from "../../_components/group-page";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <GroupPage groupId={id} />;
}
