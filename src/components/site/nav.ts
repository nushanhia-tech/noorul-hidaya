export type NavItem = { label: string; href: string; children?: { label: string; href: string; description?: string }[] };

export const MAIN_NAV: NavItem[] = [
  { label: "Home", href: "/" },
  {
    label: "About", href: "/about",
    children: [
      { label: "About the College", href: "/about", description: "History, identity and affiliation" },
      { label: "Mission & Vision", href: "/about/mission-vision", description: "What we stand for" },
      { label: "Administration", href: "/about/administration", description: "Leadership and governance" },
    ],
  },
  { label: "Departments", href: "/departments" },
  {
    label: "Academics", href: "/academics",
    children: [
      { label: "Courses & Programmes", href: "/programmes", description: "Undergraduate and postgraduate study" },
      { label: "Academic Calendar", href: "/calendar", description: "Terms, examinations and holidays" },
      { label: "Faculty Directory", href: "/faculty", description: "Our teachers and scholars" },
    ],
  },
  { label: "Courses", href: "/programmes" },
  {
    label: "Campus Life", href: "/campus-life",
    children: [
      { label: "Events", href: "/events", description: "What's happening on campus" },
      { label: "Gallery", href: "/gallery", description: "Moments from college life" },
    ],
  },
  { label: "News & Notices", href: "/news" },
  { label: "Contact", href: "/contact" },
];

export const UTILITY_NAV = [
  { label: "Notices", href: "/news#notices" },
  { label: "Calendar", href: "/calendar" },
  { label: "Faculty", href: "/faculty" },
];
