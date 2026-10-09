"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Check, X, ArrowUpRight } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";

type Notification = {
  id: string;
  type: string;
  title: string;
  body: string;
  href: string | null;
  isRead: boolean;
  createdAt: string;
};

const POLL_INTERVAL_MS = 15000;

export function NotificationBell() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  async function load() {
    const res = await fetch("/api/notifications");
    if (res.ok) {
      const data = await res.json();
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
    }
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  async function markRead(id: string) {
    await fetch(`/api/notifications/${id}`, { method: "PATCH" });
    load();
  }

  async function handleClickNotification(n: Notification) {
    if (!n.isRead) await markRead(n.id);
    setIsOpen(false);
    if (n.href) router.push(n.href);
  }

  async function handleMarkAllRead() {
    await fetch("/api/notifications/mark-all-read", { method: "POST" });
    load();
  }

  function formatTime(iso: string): string {
    const diffMin = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    if (diffMin < 1) return "Just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.round(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    return `${Math.round(diffHr / 24)}d ago`;
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="relative rounded-lg p-1.5 text-ink-300 hover:text-ink-50"
        aria-label={`Notifications, ${unreadCount} unread`}
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-status-inactive text-[9px] font-semibold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent className="inset-y-3 right-3 h-auto w-[min(440px,calc(100vw-24px))] max-w-[440px] gap-5 overflow-auto rounded-[23px] border border-white/60 bg-[rgba(238,242,246,0.96)] p-5 shadow-2xl backdrop-blur-2xl sm:max-w-[440px]">
          <SheetHeader className="p-0">
            <SheetTitle className="text-xl font-semibold tracking-tight text-neutral-900">Notification Centre</SheetTitle>
            <SheetDescription>Everything that needs your attention across Sphaera</SheetDescription>
          </SheetHeader>

          <div className="flex items-center justify-between text-xs text-neutral-500">
            <span>{unreadCount} unread</span>
            {unreadCount > 0 && (
              <button onClick={handleMarkAllRead} className="flex items-center gap-1 text-neutral-900">
                <Check size={15} /> Mark all read
              </button>
            )}
          </div>

          <div className="flex flex-col gap-3">
            {notifications.map((n) => (
              <article
                key={n.id}
                className={`rounded-2xl border border-white p-4 shadow-[0_4px_20px_rgba(42,42,42,0.03)] backdrop-blur-xl ${
                  n.isRead ? "bg-white/60" : "bg-white/85"
                }`}
              >
                <div className="flex items-center gap-2 text-xs tracking-wide text-neutral-500">
                  <span className="grid h-[22px] w-[22px] place-items-center rounded-md bg-neutral-500 font-serif text-sm text-white">S</span>
                  <span>SPHAERA · {n.type}</span>
                  <button aria-label={`Dismiss ${n.title}`} onClick={() => markRead(n.id)} className="ml-auto p-1 text-neutral-500 hover:text-neutral-900">
                    <X size={15} />
                  </button>
                </div>
                <h3 className="mt-2 flex items-center gap-2 text-[15px] font-semibold text-neutral-900">
                  {n.title}
                  {!n.isRead && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-neutral-900" />}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-neutral-600">{n.body}</p>
                <div className="mt-3 flex items-center justify-between text-xs text-neutral-500">
                  <time>{formatTime(n.createdAt)}</time>
                  {n.href && (
                    <button onClick={() => handleClickNotification(n)} className="flex items-center gap-1 text-neutral-900">
                      Open <ArrowUpRight size={13} />
                    </button>
                  )}
                </div>
              </article>
            ))}
            {notifications.length === 0 && <p className="py-8 text-center text-sm text-neutral-500">No notifications yet.</p>}
          </div>

          <p className="px-1 text-xs text-neutral-500">Checked every 15 seconds while you&rsquo;re signed in.</p>
        </SheetContent>
      </Sheet>
    </>
  );
}
