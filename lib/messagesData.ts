// Placeholder data only. Real version connects via an approved messaging
// connector (WhatsApp Business API, etc. — build spec Section 4.5) once
// channel access exists.

export type ChatMessage = {
  id: string;
  from: "me" | "them";
  text: string;
  timestamp: string;
};

export type Conversation = {
  id: string;
  name: string;
  lastMessage: string;
  lastTimestamp: string;
  online: boolean;
  messages: ChatMessage[];
};

export const conversations: Conversation[] = [
  {
    id: "c1",
    name: "Evelyn Hayes",
    lastMessage: "Thank you very much, I am waiting...",
    lastTimestamp: "12:35 PM",
    online: true,
    messages: [
      { id: "m1", from: "them", text: "Hi there, how are you?", timestamp: "12:24 PM" },
      { id: "m2", from: "them", text: "Waiting for your reply — I have to travel soon.", timestamp: "12:25 PM" },
      { id: "m3", from: "me", text: "Hi, I'm on my way, please wait!", timestamp: "12:28 PM" },
      { id: "m4", from: "them", text: "Thank you very much, I am waiting here at the showroom.", timestamp: "12:35 PM" },
    ],
  },
  {
    id: "c2",
    name: "Theodore Vance",
    lastMessage: "Call ended",
    lastTimestamp: "12:35 PM",
    online: false,
    messages: [
      { id: "m1", from: "them", text: "See you at 5:30 for the meeting.", timestamp: "11:00 AM" },
      { id: "m2", from: "me", text: "Confirmed, see you then!", timestamp: "11:02 AM" },
    ],
  },
  {
    id: "c3",
    name: "Luna Wright",
    lastMessage: "What time are we there?",
    lastTimestamp: "9:12 AM",
    online: false,
    messages: [
      { id: "m1", from: "them", text: "What time are we there?", timestamp: "9:12 AM" },
    ],
  },
  {
    id: "c4",
    name: "Jasper Reed",
    lastMessage: "You: I will send you the work file",
    lastTimestamp: "9:00 AM",
    online: false,
    messages: [
      { id: "m1", from: "me", text: "I will send you the work file", timestamp: "9:00 AM" },
    ],
  },
];
