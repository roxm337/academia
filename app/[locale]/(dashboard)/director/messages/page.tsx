import { setRequestLocale } from "next-intl/server";
import { ThreadList } from "@/components/comm/thread-list";
import { requireRole } from "@/lib/dal";

export default async function Page({
  params,
}: PageProps<"/[locale]/director/messages">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireRole("DIRECTOR");
  return <ThreadList user={user} locale={locale} basePath="/director/messages" />;
}
