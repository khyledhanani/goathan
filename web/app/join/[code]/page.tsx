import { JoinByLink } from "../../_components/join-by-link";

export default async function Page({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return <JoinByLink code={code} />;
}
