import {
  Award, Bell, BookOpen, Building2, CalendarRange, ChartColumn, Clock, ClipboardList, Folder, Globe, GraduationCap,
  Inbox, KanbanSquare, LayoutDashboard, LibraryBig, LifeBuoy, Mail, Megaphone, MessageSquare, PenLine, Receipt, Search,
  Settings, ShieldCheck, TrendingUp, User, Users, Wallet,
} from "lucide-react";
import type { IconName } from "./nav-config";

export const ICONS: Record<IconName, React.ComponentType<{ className?: string }>> = {
  dashboard: LayoutDashboard, user: User, clock: Clock, award: Award, book: BookOpen, wallet: Wallet, lifebuoy: LifeBuoy,
  bell: Bell, megaphone: Megaphone, courses: LibraryBig, pen: PenLine, trending: TrendingUp, chart: ChartColumn,
  folder: Folder, users: Users, shield: ShieldCheck, building: Building2, graduation: GraduationCap, calendar: CalendarRange,
  clipboard: ClipboardList, globe: Globe, settings: Settings, inbox: Inbox, kanban: KanbanSquare, mail: Mail, search: Search,
  message: MessageSquare, receipt: Receipt,
};
