import type { Role } from "@/lib/generated/prisma/enums";

export type NavItem = {
  /** key into the `nav` message namespace — never a literal label */
  key: string;
  href: string;
  icon: string;
};

/**
 * Sidebar per role. Routes that land in later milestones are listed already so
 * the shell is stable; each renders a "coming soon" placeholder for now.
 */
export const NAV: Record<Role, NavItem[]> = {
  DIRECTOR: [
    { key: "dashboard", href: "/director", icon: "LayoutDashboard" },
    { key: "students", href: "/director/students", icon: "Users" },
    { key: "staff", href: "/director/staff", icon: "Briefcase" },
    { key: "classes", href: "/director/classes", icon: "School" },
    { key: "subjects", href: "/director/subjects", icon: "BookOpen" },
    { key: "timetable", href: "/director/timetable", icon: "CalendarDays" },
    { key: "gradebook", href: "/director/grades", icon: "ClipboardList" },
    { key: "bulletins", href: "/director/bulletins", icon: "FileText" },
    { key: "attendance", href: "/director/attendance", icon: "UserCheck" },
    { key: "fees", href: "/director/fees", icon: "Wallet" },
    { key: "announcements", href: "/director/announcements", icon: "Megaphone" },
    { key: "auditLog", href: "/director/audit", icon: "ScrollText" },
    { key: "settings", href: "/settings", icon: "Settings" },
  ],
  SURVEILLANT: [
    { key: "dashboard", href: "/surveillant", icon: "LayoutDashboard" },
    { key: "attendance", href: "/surveillant/attendance", icon: "UserCheck" },
    { key: "justifications", href: "/surveillant/justifications", icon: "FileCheck" },
    { key: "discipline", href: "/surveillant/discipline", icon: "ShieldAlert" },
    { key: "announcements", href: "/surveillant/announcements", icon: "Megaphone" },
  ],
  TEACHER: [
    { key: "dashboard", href: "/teacher", icon: "LayoutDashboard" },
    { key: "myTimetable", href: "/teacher/timetable", icon: "CalendarDays" },
    { key: "gradebook", href: "/teacher/grades", icon: "ClipboardList" },
    { key: "cahier", href: "/teacher/cahier", icon: "NotebookPen" },
    { key: "homework", href: "/teacher/homework", icon: "BookOpen" },
    { key: "attendance", href: "/teacher/attendance", icon: "UserCheck" },
    { key: "messages", href: "/teacher/messages", icon: "MessageSquare" },
  ],
  STUDENT: [
    { key: "dashboard", href: "/student", icon: "LayoutDashboard" },
    { key: "myTimetable", href: "/student/timetable", icon: "CalendarDays" },
    { key: "myGrades", href: "/student/grades", icon: "ClipboardList" },
    { key: "myHomework", href: "/student/homework", icon: "BookOpen" },
    { key: "cahier", href: "/student/cahier", icon: "NotebookPen" },
    { key: "announcements", href: "/student/announcements", icon: "Megaphone" },
  ],
  PARENT: [
    { key: "dashboard", href: "/parent", icon: "LayoutDashboard" },
    { key: "children", href: "/parent/children", icon: "Users" },
    { key: "attendance", href: "/parent/attendance", icon: "UserCheck" },
    { key: "myGrades", href: "/parent/grades", icon: "ClipboardList" },
    { key: "myHomework", href: "/parent/homework", icon: "BookOpen" },
    { key: "fees", href: "/parent/fees", icon: "Wallet" },
    { key: "messages", href: "/parent/messages", icon: "MessageSquare" },
    { key: "announcements", href: "/parent/announcements", icon: "Megaphone" },
  ],
};
