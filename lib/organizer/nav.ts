import type { LucideIcon } from "lucide-react"
import {
  ContactRoundIcon,
  ListTodoIcon,
  TargetIcon,
  UsersIcon,
  WalletIcon,
} from "lucide-react"

export type OrganizerNavItem = {
  href: string
  label: string
  icon: LucideIcon
}

export const ORGANIZER_NAV: OrganizerNavItem[] = [
  { href: "/organizer/goals", label: "Goals", icon: TargetIcon },
  { href: "/organizer/leads", label: "Leads", icon: ContactRoundIcon },
  {
    href: "/organizer/human-resource",
    label: "Human resource",
    icon: UsersIcon,
  },
  { href: "/organizer/tasks", label: "Task", icon: ListTodoIcon },
  { href: "/organizer/budgets", label: "Budgets", icon: WalletIcon },
]
