export type EmailStatus = "scheduled" | "sent" | "failed";

export interface Email {
  id: string;
  /** Recipient name, e.g. "John Smith" */
  toName: string;
  /** Recipient email address */
  toEmail: string;
  /** Sender email address */
  fromEmail: string;
  subject: string;
  /** First line of the body, used as the table preview */
  preview: string;
  body: string;
  status: EmailStatus;
  /** ISO timestamp — scheduled time for pending emails, send time for sent ones */
  time: string;
  /** Sender display name for the detail view */
  fromName?: string;
  attachments?: Attachment[];
  starred?: boolean;
}

export interface Attachment {
  id: string;
  filename: string;
  size: string;
  url: string;
}

export interface User {
  id?: number;
  name: string;
  email: string;
  avatarUrl: string;
  slackConnected?: boolean;
}

export interface ScheduleRequest {
  from: string;
  recipients: string[];
  subject: string;
  body: string;
  /** ISO start time, or null for "send now" */
  startTime: string | null;
  /** Minimum delay between two emails, in seconds */
  delaySeconds: number;
  /** Max emails per hour */
  hourlyLimit: number;
}

export interface DashboardCounts {
  scheduled: number;
  sent: number;
}
