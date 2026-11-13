import type { Portal } from "@/lib/auth/roles";
import type { Permission } from "@/lib/auth/permissions";

export type IconName =
  | "dashboard" | "user" | "clock" | "award" | "book" | "wallet" | "lifebuoy" | "bell" | "megaphone" | "courses"
  | "pen" | "trending" | "chart" | "folder" | "users" | "shield" | "building" | "graduation" | "calendar" | "clipboard"
  | "globe" | "settings" | "inbox" | "kanban" | "mail" | "search" | "message" | "receipt";

export type NavLink = { label: string; href: string; icon: IconName; permission?: Permission | Permission[]; mobile?: boolean };
export type NavGroup = { title?: string; links: NavLink[] };

export const PORTAL_NAV: Record<Portal, NavGroup[]> = {
  student: [{
    links: [
      { label: "Dashboard", href: "/portal/student", icon: "dashboard", mobile: true },
      { label: "Timetable", href: "/portal/student/timetable", icon: "clock", mobile: true },
      { label: "Results", href: "/portal/student/results", icon: "award", mobile: true },
      { label: "Study Materials", href: "/portal/student/materials", icon: "book" },
      { label: "Fees & Payments", href: "/portal/student/fees", icon: "wallet", mobile: true },
      { label: "Help Desk", href: "/portal/student/helpdesk", icon: "lifebuoy" },
      { label: "Notices", href: "/portal/student/notices", icon: "megaphone" },
      { label: "My Profile", href: "/portal/student/profile", icon: "user" },
    ],
  }],
  faculty: [{
    links: [
      { label: "Dashboard", href: "/portal/faculty", icon: "dashboard", mobile: true },
      { label: "Timetable", href: "/portal/faculty/timetable", icon: "clock", mobile: true },
      { label: "My Courses", href: "/portal/faculty/courses", icon: "courses", mobile: true },
      { label: "Marks Entry", href: "/portal/faculty/marks", icon: "pen", mobile: true },
      { label: "Academic Progress", href: "/portal/faculty/progress", icon: "trending" },
      { label: "Reports", href: "/portal/faculty/reports", icon: "chart" },
      { label: "Teaching Resources", href: "/portal/faculty/resources", icon: "folder" },
      { label: "Notices", href: "/portal/faculty/notices", icon: "megaphone" },
      { label: "My Profile", href: "/portal/faculty/profile", icon: "user" },
    ],
  }],
  parent: [{
    links: [
      { label: "Dashboard", href: "/portal/parent", icon: "dashboard", mobile: true },
      { label: "Student Profile", href: "/portal/parent/student", icon: "user" },
      { label: "Results", href: "/portal/parent/results", icon: "award", mobile: true },
      { label: "Fees", href: "/portal/parent/fees", icon: "wallet", mobile: true },
      { label: "Notices", href: "/portal/parent/notices", icon: "megaphone" },
      { label: "Messages", href: "/portal/parent/messages", icon: "message", mobile: true },
    ],
  }],
  admin: [
    { links: [{ label: "Dashboard", href: "/portal/admin", icon: "dashboard", mobile: true }] },
    {
      title: "People",
      links: [
        { label: "Users", href: "/portal/admin/users", icon: "users", permission: "users.manage", mobile: true },
        { label: "Roles & Permissions", href: "/portal/admin/roles", icon: "shield", permission: "roles.manage" },
      ],
    },
    {
      title: "Academics",
      links: [
        { label: "Departments", href: "/portal/admin/departments", icon: "building", permission: "academics.manage" },
        { label: "Programmes & Courses", href: "/portal/admin/programmes", icon: "graduation", permission: "academics.manage", mobile: true },
        { label: "Academic Setup", href: "/portal/admin/academic", icon: "calendar", permission: "academics.manage" },
        { label: "Offerings & Timetable", href: "/portal/admin/offerings", icon: "clock", permission: "academics.manage" },
        { label: "Examinations", href: "/portal/admin/exams", icon: "clipboard", permission: ["academics.manage", "results.publish"] },
      ],
    },
    {
      title: "Communication",
      links: [
        { label: "Website Content", href: "/portal/admin/website", icon: "globe", permission: "cms.manage", mobile: true },
        { label: "Notices", href: "/portal/admin/notices", icon: "megaphone", permission: "notices.publish" },
        { label: "Contact Messages", href: "/portal/admin/messages", icon: "inbox", permission: "cms.manage" },
      ],
    },
    {
      title: "System",
      links: [
        { label: "Reports", href: "/portal/admin/reports", icon: "chart", permission: "reports.admin" },
        { label: "Settings", href: "/portal/admin/settings", icon: "settings", permission: "settings.manage" },
        { label: "Full Site Reset", href: "/portal/admin/settings/reset", icon: "shield", permission: ["users.manage"] },
      ],
    },
  ],
  office: [
    {
      links: [
        { label: "Dashboard", href: "/portal/office", icon: "dashboard", mobile: true },
        { label: "Student Search", href: "/portal/office/students", icon: "search", permission: "students.lookup" },
      ],
    },
    {
      title: "Modules",
      links: [
        { label: "Files", href: "/portal/office/files", icon: "folder", permission: ["files.manage", "files.view_all"], mobile: true },
        { label: "Fees & Accounts", href: "/portal/office/accounts", icon: "wallet", permission: "finance.view", mobile: true },
        { label: "Tasks", href: "/portal/office/tasks", icon: "kanban", mobile: true },
        { label: "Correspondence", href: "/portal/office/correspondence", icon: "mail", permission: "letters.view" },
        { label: "Help Desk", href: "/portal/office/helpdesk", icon: "lifebuoy", permission: "helpdesk.handle" },
        { label: "Parent Messages", href: "/portal/office/parents", icon: "message", permission: "parents.respond" },
        { label: "Reports & Analytics", href: "/portal/office/reports", icon: "chart", permission: ["office.reports", "finance.view"] },
      ],
    },
    { title: "Information", links: [{ label: "Notices", href: "/portal/office/notices", icon: "megaphone" }] },
  ],
};

export const PORTAL_ACCENT: Record<Portal, string> = {
  student: "bg-teal", faculty: "bg-royal", parent: "bg-plum", admin: "bg-ink", office: "bg-accent",
};
