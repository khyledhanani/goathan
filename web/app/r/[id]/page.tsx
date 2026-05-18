import { ReceiptDetailScreen } from "../../_components/receipt-detail-screen";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ReceiptDetailScreen completionId={id} />;
}
