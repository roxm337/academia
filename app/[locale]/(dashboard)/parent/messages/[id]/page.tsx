import { setRequestLocale } from "next-intl/server";
import { ThreadView } from "@/components/comm/thread-view";
import { requireRole } from "@/lib/dal";

export default async function Page({
  params,
}: PageProps<"/[locale]/parent/messages/[id]">) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const user = await requireRole("PARENT");
  return <ThreadView threadId={id} user={user} locale={locale} basePath="/parent/messages" />;
}
