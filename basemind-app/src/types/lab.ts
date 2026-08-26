/**
 * Types for the `lab` schema.
 *
 * Deliberately a separate file from `database.ts` rather than another key
 * on the same `Database` type. The app's schema and this one are installed
 * independently — someone can run the app's migrations and never run
 * `supabase/lab/` — so the two type surfaces should be as separable as the
 * two schemas are. `database.ts` describes what the app cannot work
 * without; this describes what is optional.
 *
 * Same constraint as there: these must be `type` aliases, not interfaces.
 * Supabase's generics require an implicit index signature, which an
 * interface does not have, and the failure is silent — every insert
 * argument quietly degrades to `never`.
 */

/** 1-8, matching the --avatar-N hues in the stylesheet. */
export type Hue = number;

export type Patrol = {
  id: string;
  name: string;
  colour: Hue;
  motto: string | null;
  emblem: string | null;
  sort_order: number;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type NewPatrol = Omit<Patrol, "id" | "created_at" | "updated_at">;

/**
 * A young person in the group — not an app user. They have no login and
 * no row in public.users, which is why the contact details live here.
 */
export type Member = {
  id: string;
  first_name: string;
  last_name: string;
  patrol_id: string | null;
  date_of_birth: string | null;
  joined_on: string | null;
  rank: string | null;
  parent_name: string | null;
  parent_phone: string | null;
  parent_email: string | null;
  medical_notes: string | null;
  dietary_notes: string | null;
  allergies: string | null;
  photo_consent: boolean;
  swim_ability: string | null;
  notes: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type NewMember = Omit<Member, "id" | "created_at" | "updated_at">;

/** Free text, but these are the four the UI offers. */
export const ATTENDANCE_STATUSES = ["Coming", "Not coming", "Maybe", "Unknown"] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export type Attendance = {
  id: string;
  event_id: string;
  member_id: string;
  status: string;
  paid: boolean;
  consent_form_in: boolean;
  transport: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type NewAttendance = Omit<Attendance, "id" | "created_at" | "updated_at">;

export type LabBadge = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  colour: Hue;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type NewLabBadge = Omit<LabBadge, "id" | "created_at" | "updated_at">;

export type BadgeRequirement = {
  id: string;
  badge_id: string;
  text: string;
  sort_order: number;
  created_at: string;
};

export type NewBadgeRequirement = Omit<BadgeRequirement, "id" | "created_at">;

export type MemberBadge = {
  id: string;
  member_id: string;
  badge_id: string;
  awarded_on: string;
  awarded_by: string | null;
  notes: string | null;
  created_at: string;
};

export type NewMemberBadge = Omit<MemberBadge, "id" | "created_at">;

export type MemberRequirement = {
  id: string;
  member_id: string;
  requirement_id: string;
  done_on: string;
  signed_off_by: string | null;
  note: string | null;
  created_at: string;
};

export type NewMemberRequirement = Omit<MemberRequirement, "id" | "created_at">;

export type PointAward = {
  id: string;
  patrol_id: string;
  member_id: string | null;
  points: number;
  reason: string;
  awarded_by: string | null;
  awarded_at: string;
};

export type NewPointAward = Omit<PointAward, "id" | "awarded_at"> & { awarded_at?: string };

export type Activity = {
  id: string;
  name: string;
  description: string | null;
  kind: string | null;
  duration_minutes: number;
  indoors: boolean;
  outdoors: boolean;
  min_people: number | null;
  max_people: number | null;
  kit_needed: string | null;
  instructions: string | null;
  risk_notes: string | null;
  source: string | null;
  favourite: boolean;
  times_run: number;
  created_at: string;
  updated_at: string;
};

export type NewActivity = Omit<Activity, "id" | "created_at" | "updated_at">;

export type Programme = {
  id: string;
  title: string;
  meets_on: string;
  theme: string | null;
  location: string | null;
  lead_person: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type NewProgramme = Omit<Programme, "id" | "created_at" | "updated_at">;

export type ProgrammeSlot = {
  id: string;
  programme_id: string;
  title: string;
  activity_id: string | null;
  minutes: number;
  lead_person: string | null;
  notes: string | null;
  sort_order: number;
  created_at: string;
};

export type NewProgrammeSlot = Omit<ProgrammeSlot, "id" | "created_at">;

export const TASK_STATUSES = ["Todo", "Doing", "Blocked", "Done"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export type Task = {
  id: string;
  event_id: string | null;
  title: string;
  detail: string | null;
  status: string;
  assignee_id: string | null;
  due_on: string | null;
  /** 1 = must happen, 3 = would be nice. */
  priority: number;
  sort_order: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type NewTask = Omit<Task, "id" | "created_at" | "updated_at">;

export type Duty = {
  id: string;
  event_id: string;
  day_number: number;
  duty: string;
  patrol_id: string | null;
  member_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type NewDuty = Omit<Duty, "id" | "created_at" | "updated_at">;

export type Expense = {
  id: string;
  event_id: string | null;
  description: string;
  category: string | null;
  /** Minor units. Never a float — see the migration. */
  amount_cents: number;
  paid_by: string | null;
  spent_on: string;
  reimbursed: boolean;
  receipt_path: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type NewExpense = Omit<Expense, "id" | "created_at" | "updated_at">;

export type Budget = {
  id: string;
  event_id: string;
  charge_per_head_cents: number;
  subs_collected_cents: number;
  grant_cents: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type NewBudget = Omit<Budget, "id" | "created_at" | "updated_at">;

export type RiskAssessment = {
  id: string;
  title: string;
  event_id: string | null;
  activity_id: string | null;
  assessor: string | null;
  assessed_on: string;
  review_on: string | null;
  approved_by: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type NewRiskAssessment = Omit<RiskAssessment, "id" | "created_at" | "updated_at">;

export type RiskLine = {
  id: string;
  assessment_id: string;
  hazard: string;
  who_at_risk: string | null;
  likelihood: number;
  severity: number;
  controls: string | null;
  residual_note: string | null;
  sort_order: number;
  created_at: string;
};

export type NewRiskLine = Omit<RiskLine, "id" | "created_at">;

export const INCIDENT_KINDS = ["Near miss", "Injury", "Illness", "Damage", "Safeguarding"] as const;

export type Incident = {
  id: string;
  event_id: string | null;
  happened_at: string;
  kind: string;
  who_involved: string | null;
  what_happened: string;
  action_taken: string | null;
  first_aid_given: boolean;
  parents_informed: boolean;
  reportable: boolean;
  reported_by: string | null;
  created_at: string;
  updated_at: string;
};

export type NewIncident = Omit<Incident, "id" | "created_at" | "updated_at">;

export type Announcement = {
  id: string;
  title: string;
  body: string;
  pinned: boolean;
  expires_on: string | null;
  author_id: string | null;
  created_at: string;
  updated_at: string;
};

export type NewAnnouncement = Omit<Announcement, "id" | "created_at" | "updated_at">;

export type AnnouncementReaction = {
  id: string;
  announcement_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
};

export type NewAnnouncementReaction = Omit<AnnouncementReaction, "id" | "created_at">;

export type Message = {
  id: string;
  channel: string;
  author_id: string | null;
  body: string;
  /** Soft delete — the row stays so the thread keeps its shape. */
  deleted_at: string | null;
  created_at: string;
};

export type NewMessage = Omit<Message, "id" | "created_at">;

export type Poll = {
  id: string;
  question: string;
  detail: string | null;
  multi: boolean;
  closes_on: string | null;
  closed: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type NewPoll = Omit<Poll, "id" | "created_at" | "updated_at">;

export type PollOption = {
  id: string;
  poll_id: string;
  label: string;
  sort_order: number;
  created_at: string;
};

export type NewPollOption = Omit<PollOption, "id" | "created_at">;

export type PollVote = {
  id: string;
  option_id: string;
  user_id: string;
  created_at: string;
};

export type NewPollVote = Omit<PollVote, "id" | "created_at">;

export type MaintenanceLog = {
  id: string;
  equipment_id: string;
  logged_on: string;
  kind: string;
  detail: string | null;
  cost_cents: number;
  done_by: string | null;
  created_at: string;
};

export type NewMaintenanceLog = Omit<MaintenanceLog, "id" | "created_at">;

export type Stocktake = {
  id: string;
  name: string;
  started_at: string;
  finished_at: string | null;
  started_by: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type NewStocktake = Omit<Stocktake, "id" | "created_at" | "updated_at">;

export type StocktakeEntry = {
  id: string;
  stocktake_id: string;
  equipment_id: string;
  /** Snapshotted when counting started, not read live. */
  expected_quantity: number;
  /** Null until somebody counts it. */
  counted_quantity: number | null;
  condition: string | null;
  note: string | null;
  counted_at: string | null;
  counted_by: string | null;
};

export type NewStocktakeEntry = Omit<StocktakeEntry, "id">;

export const WISHLIST_STATUSES = ["Requested", "Approved", "Bought", "Declined"] as const;

export type WishlistItem = {
  id: string;
  item: string;
  why: string | null;
  estimated_cents: number;
  status: string;
  requested_by: string | null;
  decided_by: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type NewWishlistItem = Omit<WishlistItem, "id" | "created_at" | "updated_at">;

export type WishlistVote = {
  id: string;
  wishlist_id: string;
  user_id: string;
  created_at: string;
};

export type NewWishlistVote = Omit<WishlistVote, "id" | "created_at">;

export type KitList = {
  id: string;
  name: string;
  description: string | null;
  kind: string;
  created_at: string;
  updated_at: string;
};

export type NewKitList = Omit<KitList, "id" | "created_at" | "updated_at">;

export type KitListItem = {
  id: string;
  kit_list_id: string;
  item: string;
  quantity: number;
  weight_grams: number | null;
  essential: boolean;
  note: string | null;
  sort_order: number;
  created_at: string;
};

export type NewKitListItem = Omit<KitListItem, "id" | "created_at">;

export type SiteReview = {
  id: string;
  site_id: string;
  rating: number;
  comment: string | null;
  stayed_on: string | null;
  author_id: string | null;
  created_at: string;
  updated_at: string;
};

export type NewSiteReview = Omit<SiteReview, "id" | "created_at" | "updated_at">;

export type Photo = {
  id: string;
  event_id: string | null;
  storage_path: string;
  caption: string | null;
  taken_on: string | null;
  uploaded_by: string | null;
  created_at: string;
};

export type NewPhoto = Omit<Photo, "id" | "created_at">;

/** Lab's own switches, separate from the app's `public.feature_flags`. */
export type LabFeatureKey =
  | "dashboard"
  | "members"
  | "progression"
  | "attendance"
  | "points"
  | "programme"
  | "tasks"
  | "duties"
  | "money"
  | "risk"
  | "noticeboard"
  | "chat"
  | "polls"
  | "gallery"
  | "maintenance"
  | "wishlist"
  | "kitlists"
  | "reviews"
  | "toolkit";

export type LabFeatureFlag = {
  key: LabFeatureKey;
  label: string;
  description: string | null;
  enabled: boolean;
  sort_order: number;
  updated_at: string;
};

export type LabSetting = {
  key: string;
  value: Record<string, unknown>;
  updated_at: string;
};

export type AuditEntry = {
  id: string;
  table_name: string;
  row_id: string | null;
  action: string;
  actor_id: string | null;
  summary: string | null;
  at: string;
};

export type NewAuditEntry = Omit<AuditEntry, "id" | "at">;

// --- Function return shapes -------------------------------------------

export type PatrolStanding = {
  patrol_id: string;
  name: string;
  colour: Hue;
  emblem: string | null;
  points: number;
  member_count: number;
  last_awarded_at: string | null;
};

export type MemberProgress = {
  member_id: string;
  badges_awarded: number;
  requirements_done: number;
  last_awarded_on: string | null;
};

export type EventMoney = {
  spent_cents: number;
  unreimbursed_cents: number;
  charge_per_head_cents: number;
  subs_collected_cents: number;
  grant_cents: number;
  attending: number;
  cost_per_head_cents: number | null;
};

/**
 * jsonb rather than a wide row, so a key the database has not started
 * returning yet reads as undefined instead of failing the query. Every
 * field is optional for the same reason.
 */
export type DashboardCounts = {
  members_active?: number;
  patrols?: number;
  badges_awarded_30d?: number;
  tasks_open?: number;
  tasks_overdue?: number;
  incidents_30d?: number;
  unread_notices?: number;
  open_polls?: number;
  wishlist_open?: number;
  photos?: number;
  equipment_items?: number;
  equipment_needing_repair?: number;
  loans_out?: number;
  loans_overdue?: number;
  events_upcoming?: number;
  next_event?: {
    id: string;
    name: string;
    start_date: string;
    end_date: string | null;
    headcount: number | null;
  } | null;
};

type TableDef<Row, Insert, Update = Partial<Insert>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type LabDatabase = {
  lab: {
    Tables: {
      patrols: TableDef<Patrol, NewPatrol>;
      members: TableDef<Member, NewMember>;
      attendance: TableDef<Attendance, NewAttendance>;
      badges: TableDef<LabBadge, NewLabBadge>;
      badge_requirements: TableDef<BadgeRequirement, NewBadgeRequirement>;
      member_badges: TableDef<MemberBadge, NewMemberBadge>;
      member_requirements: TableDef<MemberRequirement, NewMemberRequirement>;
      point_awards: TableDef<PointAward, NewPointAward>;
      activities: TableDef<Activity, NewActivity>;
      programmes: TableDef<Programme, NewProgramme>;
      programme_slots: TableDef<ProgrammeSlot, NewProgrammeSlot>;
      tasks: TableDef<Task, NewTask>;
      duties: TableDef<Duty, NewDuty>;
      expenses: TableDef<Expense, NewExpense>;
      budgets: TableDef<Budget, NewBudget>;
      risk_assessments: TableDef<RiskAssessment, NewRiskAssessment>;
      risk_lines: TableDef<RiskLine, NewRiskLine>;
      incidents: TableDef<Incident, NewIncident>;
      announcements: TableDef<Announcement, NewAnnouncement>;
      announcement_reactions: TableDef<AnnouncementReaction, NewAnnouncementReaction>;
      messages: TableDef<Message, NewMessage>;
      polls: TableDef<Poll, NewPoll>;
      poll_options: TableDef<PollOption, NewPollOption>;
      poll_votes: TableDef<PollVote, NewPollVote>;
      maintenance_logs: TableDef<MaintenanceLog, NewMaintenanceLog>;
      stocktakes: TableDef<Stocktake, NewStocktake>;
      stocktake_entries: TableDef<StocktakeEntry, NewStocktakeEntry>;
      wishlist: TableDef<WishlistItem, NewWishlistItem>;
      wishlist_votes: TableDef<WishlistVote, NewWishlistVote>;
      kit_lists: TableDef<KitList, NewKitList>;
      kit_list_items: TableDef<KitListItem, NewKitListItem>;
      site_reviews: TableDef<SiteReview, NewSiteReview>;
      photos: TableDef<Photo, NewPhoto>;
      feature_flags: TableDef<LabFeatureFlag, LabFeatureFlag, Partial<LabFeatureFlag>>;
      settings: TableDef<LabSetting, LabSetting, Partial<LabSetting>>;
      audit_log: TableDef<AuditEntry, NewAuditEntry>;
    };
    Views: { [_ in never]: never };
    Functions: {
      patrol_standings: { Args: Record<string, never>; Returns: PatrolStanding[] };
      member_progress: { Args: Record<string, never>; Returns: MemberProgress[] };
      roll_call: { Args: { target_event_id: string }; Returns: number };
      start_stocktake: { Args: { stocktake_name: string }; Returns: string };
      copy_programme: {
        Args: { source_programme_id: string; new_date: string; new_title?: string | null };
        Returns: string;
      };
      event_money: { Args: { target_event_id: string }; Returns: EventMoney[] };
      dashboard: { Args: Record<string, never>; Returns: DashboardCounts };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

export type LabTableName = keyof LabDatabase["lab"]["Tables"];
