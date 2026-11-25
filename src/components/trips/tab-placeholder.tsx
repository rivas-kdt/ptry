import { Construction } from "lucide-react";
import { EmptyState } from "@/components/layout-primitives";

export function TabPlaceholder({ title, description }: { title: string; description: string }) {
  return <EmptyState icon={<Construction />} title={title} description={description} />;
}
