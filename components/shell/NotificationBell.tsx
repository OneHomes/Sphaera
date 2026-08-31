"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";

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

  async function handleOpen() {
    setIsOpen((prev) => !prev);
  }

  async function handleClickNotification(n: Notification) {
    if (!n.isRead) {
      await fetch(`/api/notifications/${n.id}`, { method: "PATCH" });
      load();
    }
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
    <div className="relative">
      <button
        onClick={handleOpen}
        className="relative rounded-lg p-1.5 text-ink-300 hover:text-ink-50"
        aria-label="Notifications"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-status-inactive text-[9px] font-semibold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 z-50 mt-2 w-80 rounded-xl border border-base-700 bg-base-900 shadow-lg">
            <div className="flex items-center justify-between border-b border-base-700 p-3">
              <p className="text-xs font-medium text-ink-50">Notifications</p>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="text-[11px] text-ink-500 hover:text-ink-300"
                >
                  Mark all read
                </button>
              )}
            </div>
            <div className="max-h-96 overflow-y-auto">
              {notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleClickNotification(n)}
                  className={`w-full border-b border-base-700 p-3 text-left transition hover:bg-base-800 ${
                    !n.isRead ? "bg-base-800/50" : ""
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs ${!n.isRead ? "font-semibold text-ink-50" : "text-ink-300"}`}
                    >
                      {n.title}
                    </span>
                    {!n.isRead && (
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-status-active" />
                    )}
                  </div>
                  <p className="mt-0.5 text-[11px] text-ink-500">{n.body}</p>
                  <p className="mt-1 text-[10px] text-ink-500">
                    {formatTime(n.createdAt)}
                  </p>
                </button>
              ))}
              {notifications.length === 0 && (
                <p className="p-4 text-center text-xs text-ink-500">
                  No notifications yet.
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}