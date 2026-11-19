import { orgStatusLabel, type OrgStatus } from "../../shared/crm";
import { Chip } from "../ui";

const tone = { prospect: "magenta", client: "brand", former: "muted" } as const;

export function StatusChip({ status }: { status: OrgStatus }) {
  return <Chip tone={tone[status]}>{orgStatusLabel[status]}</Chip>;
}
