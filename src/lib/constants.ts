export const TICKET_CATEGORIES = {
  certificate_enquiry: "Certificate enquiry",
  certificate_request: "Certificate request",
  fee_issue: "Fee issue",
  receipt_request: "Receipt request",
  record_correction: "Student record correction",
  document_verification: "Document verification",
  general_enquiry: "General enquiry",
  other: "Other office service",
} as const;
export type TicketCategory = keyof typeof TICKET_CATEGORIES;

export const TICKET_STATUSES = ["open", "assigned", "in_progress", "waiting_student", "resolved", "closed"] as const;
export const TICKET_STATUS_LABELS: Record<string, string> = {
  open: "Open", assigned: "Assigned", in_progress: "In progress", waiting_student: "Waiting for student", resolved: "Resolved", closed: "Closed",
};

export const FILE_STATUSES = ["new", "assigned", "in_progress", "waiting_info", "completed", "archived"] as const;
export const FILE_STATUS_LABELS: Record<string, string> = {
  new: "New", assigned: "Assigned", in_progress: "In progress", waiting_info: "Waiting for information", completed: "Completed", archived: "Archived",
};
export const FILE_CATEGORIES = {
  student_record: "Student record", academic: "Academic", examination: "Examination", finance: "Finance",
  establishment: "Establishment", general: "General administration", legal: "Legal", correspondence: "Correspondence",
} as const;

export const TASK_STATUSES = ["todo", "in_progress", "waiting", "completed", "cancelled"] as const;
export const TASK_STATUS_LABELS: Record<string, string> = { todo: "To do", in_progress: "In progress", waiting: "Waiting", completed: "Completed", cancelled: "Cancelled" };
export const PRIORITIES = ["low", "normal", "high", "urgent"] as const;

export const PAYMENT_METHODS = { cash: "Cash", bank_transfer: "Bank transfer", upi: "UPI", cheque: "Cheque", demand_draft: "Demand draft", online: "Online gateway" } as const;

export const LETTER_MODES = { post: "Post", registered_post: "Registered post", speed_post: "Speed post", courier: "Courier", email: "Email", hand_delivery: "Hand delivery", fax: "Fax" } as const;
export const INWARD_STATUSES = ["received", "under_action", "closed"] as const;
export const OUTWARD_STATUSES = ["draft", "ready", "dispatched", "delivered", "returned"] as const;
