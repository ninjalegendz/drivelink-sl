export type TutorialAudience = "renter" | "traveller" | "owner" | "staff" | "admin";

export type TutorialLanguage = "English" | "Sinhala" | "Tamil";

export interface Tutorial {
  slug: string;
  audience: TutorialAudience;
  title: string;
  shortTitle: string;
  description: string;
  duration: string;
  steps: string[];
  relatedRoutes: string[];
  uploadFilename: string;
  subtitles: Record<TutorialLanguage, string>;
  youtubeUrl: string | null;
}

export const TUTORIAL_AUDIENCE_LABELS: Record<TutorialAudience, string> = {
  renter: "Renters",
  traveller: "Visitors to Sri Lanka",
  owner: "Rental Page owners",
  staff: "Rental Page staff",
  admin: "DriveLink team",
};

export const TUTORIALS: Tutorial[] = [
  {
    slug: "rent-your-first-vehicle",
    audience: "renter",
    title: "Rent your first vehicle",
    shortTitle: "Your first booking",
    description: "Find a suitable vehicle, read the important terms, verify your account, and send a request with confidence.",
    duration: "1 min",
    steps: ["Choose how you want to travel", "Compare the listing terms", "Verify your account", "Send a request and wait for acceptance", "Use the pickup and return records"],
    relatedRoutes: ["/", "/vehicles", "/bookings", "/account"],
    uploadFilename: "01-rent-your-first-vehicle.mp4",
    subtitles: {
      English: "01-rent-your-first-vehicle.en.srt",
      Sinhala: "01-rent-your-first-vehicle.si.srt",
      Tamil: "01-rent-your-first-vehicle.ta.srt",
    },
    youtubeUrl: "https://youtube.com/shorts/vsJm5bkezJk?feature=share",
  },
  {
    slug: "self-drive-in-sri-lanka",
    audience: "traveller",
    title: "Self-drive in Sri Lanka",
    shortTitle: "Self-drive essentials",
    description: "Understand licence and permit checks, hire insurance, the pickup record, and what to do if plans change.",
    duration: "1 min",
    steps: ["Choose self-drive or with driver", "Declare your licence or permit", "Check hire insurance", "Confirm the vehicle at pickup", "Keep every change inside the booking"],
    relatedRoutes: ["/vehicles", "/account", "/guides/accident-protocol"],
    uploadFilename: "02-self-drive-in-sri-lanka.mp4",
    subtitles: {
      English: "02-self-drive-in-sri-lanka.en.srt",
      Sinhala: "02-self-drive-in-sri-lanka.si.srt",
      Tamil: "02-self-drive-in-sri-lanka.ta.srt",
    },
    youtubeUrl: "https://youtube.com/shorts/GgEIFwFqxBQ?feature=share",
  },
  {
    slug: "create-your-rental-page",
    audience: "owner",
    title: "Create a Rental Page and list a vehicle",
    shortTitle: "Your first listing",
    description: "Create your page, add a clear listing, choose the right terms, and understand the review steps before it goes live.",
    duration: "1 min",
    steps: ["Verify your identity", "Create your Rental Page", "Add clear vehicle photos", "Set your availability and terms", "Send the listing for review"],
    relatedRoutes: ["/account/pages/new", "/dashboard", "/dashboard/vehicles/new"],
    uploadFilename: "03-create-a-rental-page-and-list-a-vehicle.mp4",
    subtitles: {
      English: "03-create-a-rental-page-and-list-a-vehicle.en.srt",
      Sinhala: "03-create-a-rental-page-and-list-a-vehicle.si.srt",
      Tamil: "03-create-a-rental-page-and-list-a-vehicle.ta.srt",
    },
    youtubeUrl: "https://youtube.com/shorts/zb_ozUle5nE?feature=share",
  },
  {
    slug: "run-a-rental-from-request-to-return",
    audience: "owner",
    title: "Run a rental from request to return",
    shortTitle: "Manage a rental",
    description: "Accept responsibly, share documents with consent, complete inspections, record direct payments, and close the rental well.",
    duration: "1 min",
    steps: ["Review the request", "Accept and get consent", "Complete the agreement", "Record pickup and return", "Resolve a charge or issue with evidence"],
    relatedRoutes: ["/dashboard", "/dashboard/bookings", "/dashboard/bookings/[id]/documents"],
    uploadFilename: "04-run-a-rental-from-request-to-return.mp4",
    subtitles: {
      English: "04-run-a-rental-from-request-to-return.en.srt",
      Sinhala: "04-run-a-rental-from-request-to-return.si.srt",
      Tamil: "04-run-a-rental-from-request-to-return.ta.srt",
    },
    youtubeUrl: "https://youtube.com/shorts/9cSk1r1v1ds?feature=share",
  },
  {
    slug: "work-safely-as-rental-page-staff",
    audience: "staff",
    title: "Work safely as Rental Page staff",
    shortTitle: "Staff essentials",
    description: "Use the Dashboard for the work assigned to you, keep customer information private, and pass the right work to a manager.",
    duration: "1 min",
    steps: ["Open the correct Rental Page", "See the work assigned to your role", "Use booking messages carefully", "Complete only your handover tasks", "Escalate exceptions to a manager"],
    relatedRoutes: ["/dashboard", "/dashboard/bookings", "/dashboard/settings"],
    uploadFilename: "05-work-safely-as-rental-page-staff.mp4",
    subtitles: {
      English: "05-work-safely-as-rental-page-staff.en.srt",
      Sinhala: "05-work-safely-as-rental-page-staff.si.srt",
      Tamil: "05-work-safely-as-rental-page-staff.ta.srt",
    },
    youtubeUrl: "https://youtube.com/shorts/b-AvVD3h2jM?feature=share",
  },
  {
    slug: "review-and-resolve-as-drive-link-admin",
    audience: "admin",
    title: "Review and resolve as a DriveLink admin",
    shortTitle: "Admin review flow",
    description: "Triage listings, identity work, reports, and cases in priority order while keeping decisions evidence-based.",
    duration: "1 min",
    steps: ["Start with the action queue", "Review the evidence and policy", "Request only what is needed", "Record a clear decision", "Keep sensitive information inside the case"],
    relatedRoutes: ["/admin", "/admin/vehicles", "/admin/cases", "/admin/reports"],
    uploadFilename: "06-review-and-resolve-as-drivelink-admin.mp4",
    subtitles: {
      English: "06-review-and-resolve-as-drivelink-admin.en.srt",
      Sinhala: "06-review-and-resolve-as-drivelink-admin.si.srt",
      Tamil: "06-review-and-resolve-as-drivelink-admin.ta.srt",
    },
    youtubeUrl: "https://youtube.com/shorts/_WsZQYrmUmE?feature=share",
  },
];

export function tutorialForAudience(audience: TutorialAudience): Tutorial {
  return TUTORIALS.find((tutorial) => tutorial.audience === audience) ?? TUTORIALS[0];
}

export function tutorialBySlug(slug: string): Tutorial | undefined {
  return TUTORIALS.find((tutorial) => tutorial.slug === slug);
}

export function tutorialsForAudiences(audiences: readonly TutorialAudience[]): Tutorial[] {
  const allowed = new Set(audiences);
  return TUTORIALS.filter((tutorial) => allowed.has(tutorial.audience));
}
