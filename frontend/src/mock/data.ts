import type { Attachment, Email, User } from "../types";

const tennisThumb =
  "https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?w=400&q=80";

const attachments: Attachment[] = [
  { id: "att-1", filename: "Tennis_Coach_Profile1.png", size: "1.5 MB", url: tennisThumb },
  { id: "att-2", filename: "Tennis_Coach_Profile2.png", size: "1.5 MB", url: tennisThumb },
];

export const mockUser: User = {
  name: "Oliver Brown",
  email: "oliver.brown@domain.io",
  avatarUrl: "https://i.pravatar.cc/80?img=12",
};

export const mockEmails: Email[] = [
  {
    id: "email-101",
    toName: "John Smith",
    toEmail: "john.smith@example.com",
    fromEmail: "oliver.brown@domain.io",
    fromName: "Oliver Brown",
    subject: "Meeting follow-up - Scheduled",
    preview: "Hi John, just wanted to follow up on our meeting...",
    body: "Hey Oliver,\n\nYou've just RECEIVED something\n\nYour coach for world-class performance,\n\nGrant\n\nP.S. Always remember that you can develop world class technique!",
    status: "scheduled",
    time: "2026-10-27T09:15:12",
    starred: true,
  },
  {
    id: "email-102",
    toName: "Olive",
    toEmail: "olive@example.com",
    fromEmail: "oliver.brown@domain.io",
    fromName: "Oliver Brown",
    subject: "Ramit, great to meet you - you'll love it",
    preview: "Hi Olive, just wanted to follow up on our meeting...",
    body: "Hi Olive,\n\nGreat to meet you — sharing the details we discussed.",
    status: "failed",
    time: "2026-10-29T20:15:12",
  },
  {
    id: "email-103",
    toName: "Sarah Wilson",
    toEmail: "sarah.wilson@example.com",
    fromEmail: "oliver.brown@domain.io",
    fromName: "Amanda Clark",
    subject: "Re: Project Update",
    preview: "Thanks for the update, Sarah. Looks good!",
    body: "Hey Oliver,\n\nYou've just RECEIVED something\n\n⚡ Extremely Exclusive—Only 4 Spots Worldwide Per Year | $25,000 investment ⚡\nTo explore securing your private transformation, simply reply right now with \"FLY OUT FIX\".\n\nYour coach for world-class performance,\n\nGrant\n\nP.S. Always remember that you can develop world class technique! 🚀",
    status: "sent",
    time: "2026-10-24T10:02:00",
    starred: true,
  },
  {
    id: "email-104",
    toName: "Support",
    toEmail: "support@example.com",
    fromEmail: "oliver.brown@domain.io",
    fromName: "Amanda Clark",
    subject: "Issue with login",
    preview: "I am having trouble logging in to the dashboard...",
    body: "Hi Support,\n\nI am having trouble logging in to the dashboard since this morning.",
    status: "sent",
    time: "2026-10-23T17:45:00",
  },
  {
    id: "email-105",
    toName: "Oliver",
    toEmail: "oliver@example.com",
    fromEmail: "oliver.brown@domain.io",
    fromName: "Amanda Clark",
    subject: "Oliver, hello there!",
    preview: "Hey Oliver, you've just RECEIVED something",
    body: "Hey Oliver,\n\nYou've just RECEIVED something\n\n⚡ Extremely Exclusive—Only 4 Spots Worldwide Per Year | $25,000 investment ⚡\nTo explore securing your private transformation, simply reply right now with \"FLY OUT FIX\".\n\nYour coach for world-class performance,\n\nGrant\n\nP.S. Always remember that you can develop world class technique! 🚀",
    status: "sent",
    time: "2023-02-05T12:13:00",
    attachments,
  },
];

export const mockSenders = [
  "oliver.brown@domain.io",
  "grant@domain.io",
  "amanda.clark@domain.io",
];

export const mockCounts = { scheduled: 12, sent: 785 };
