import { UserProfilePage } from "../../_components/user-profile-page";

export default async function Page({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  return <UserProfilePage userId={userId} />;
}
