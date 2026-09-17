/**
 * Shared Lucide icon name → component mapping.
 *
 * Server components pass icon names as strings (serializable), and client
 * components look them up here. This avoids passing non-serializable
 * Lucide component references across the server→client boundary.
 */
import {
  BarChart3,
  Bell,
  BookOpen,
  Building2,
  Bus,
  CalendarCheck,
  CalendarDays,
  ClipboardList,
  DollarSign,
  FileText,
  Flag,
  GraduationCap,
  HardDrive,
  HelpCircle,
  CalendarFold,
  LayoutDashboard,
  Library,
  LogOut,
  Mail,
  Megaphone,
  TrendingDown,
  TrendingUp,
  UserCog,
  Users,
  type LucideIcon,
} from "lucide-react";

export const ICON_MAP: Record<string, LucideIcon> = {
  BarChart3,
  Bell,
  BookOpen,
  Building2,
  Bus,
  CalendarCheck,
  CalendarDays,
  ClipboardList,
  DollarSign,
  FileText,
  Flag,
  GraduationCap,
  HardDrive,
  HelpCircle,
  CalendarFold,
  LayoutDashboard,
  Library,
  LogOut,
  Mail,
  Megaphone,
  TrendingDown,
  TrendingUp,
  UserCog,
  Users,
};

export type IconName = keyof typeof ICON_MAP;

/** Look up an icon by name, with a fallback. */
export function getIcon(name: string): LucideIcon {
  return ICON_MAP[name] ?? LayoutDashboard;
}
