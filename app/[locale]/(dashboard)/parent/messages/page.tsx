import { setRequestLocale } from "next-intl/server";
import { ThreadList } from "@/components/comm/thread-list";
import { requireRole } from "@/lib/dal";

export default async function Page({
  params,
}: PageProps<"/[locale]/parent/messages">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireRole("PARENT");
  return <ThreadList user={user} locale={locale} basePath="/parent/messages" />;
}
