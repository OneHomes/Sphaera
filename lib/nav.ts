import {
  Home,
  LayoutDashboard,
  Inbox,
  Activity,
  Trophy,
  Phone,
  Briefcase,
  Mail,
  Calendar,
  MessageCircle,
  Globe,
  Settings,
  FileText,
  BookOpen,
  Users,
  User,
  CheckSquare,
  ShieldCheck,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: typeof Home;
  adminOnly?: boolean;
  managerAndAbove?: boolean;
};

// Order and icon set follow the reference walkthrough's persistent left rail.
export const navItems: NavItem[] = [
  { href: "/command", label: "Home", icon: Home },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/leads", label: "Leads", icon: Inbox },
  { href: "/pipeline", label: "Pipeline", icon: Briefcase },
  { href: "/business-activity", label: "Business Activity", icon: Activity, managerAndAbove: true },
  { href: "/aex", label: "AEX", icon: Trophy },
  { href: "/calls", label: "Calls & Deals", icon: Phone },
  { href: "/mail", label: "Mail", icon: Mail },
  { href: "/calendar", label: "Calendar", icon: Calendar },
  { href: "/messages", label: "Messages", icon: MessageCircle },
  { href: "/journal", label: "Journal", icon: BookOpen },
  { href: "/search", label: "Search", icon: Globe },
  { href: "/documents", label: "Documents", icon: FileText },
  { href: "/people", label: "People", icon: Users },
  { href: "/profile", label: "Profile", icon: User },
  { href: "/tasks", label: "Tasks", icon: CheckSquare },
  { href: "/admin/users", label: "Admin", icon: ShieldCheck, adminOnly: true },
  { href: "/settings", label: "Settings", icon: Settings },
];