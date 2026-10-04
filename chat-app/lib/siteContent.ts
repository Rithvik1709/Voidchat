/** Copy that appears on the page AND in its structured data, kept in one place. */

export const FAQ = [
  {
    q: "Do I need an account?",
    a: "No. You choose a temporary display name for the session. There is no email, phone number or password involved.",
  },
  {
    q: "What happens when a room ends?",
    a: "The room, its messages and any shared images or voice notes are removed for everyone.",
  },
  {
    q: "Can I share images and voice messages?",
    a: "Yes. Images up to 25MB and voice messages are supported, and they are cleaned up automatically along with the room.",
  },
  {
    q: "How do I invite people?",
    a: "Share the room link, or make a one-time link for each person from the Invite button. A one-time link works for a single person and then burns, so a forwarded or copied link can't be reused. They join straight from their browser.",
  },
  {
    q: "Can messages disappear on their own?",
    a: "Yes. Turn on burn mode when you create a room and every message turns to sand after the time you choose, for everyone in the room. You can also set the room itself to close automatically.",
  },
  {
    q: "Can I limit who joins or add a password?",
    a: "Yes. Set a member limit of any size, add a room password on top of the link, or make the room invite-only so people can enter only through one-time links.",
  },
] as const;

/** Real situations the product suits, written for people searching by need rather than by name. */
export const USE_CASES = [
  {
    title: "Anonymous Q&A in class or at work",
    body: "Let people ask the awkward question without putting their name to it. Open a room, share the link, and close it when the session is over.",
  },
  {
    title: "A private backchannel for events",
    body: "Give a talk, a meetup or a game night its own chat that exists only for the event. Set a timer and the room closes itself.",
  },
  {
    title: "Plans that shouldn't stick around",
    body: "Sort out a surprise, a trip or a sensitive group decision, then let burn mode turn the messages to sand.",
  },
  {
    title: "Feedback and tips, without a trail",
    body: "Hand out one-time links so each person gets in once. No accounts, no phone numbers, and nothing stored afterwards.",
  },
] as const;
