// Простой парсер user-agent в человекочитаемое «OS / браузер / устройство».
export function parseUA(ua: string | null | undefined): {
  os: string;
  browser: string;
  device: string;
} {
  if (!ua) return { os: "—", browser: "—", device: "—" };
  const s = ua;
  let os = "—";
  if (/Windows NT 10/i.test(s)) os = "Windows 10/11";
  else if (/Windows NT/i.test(s)) os = "Windows";
  else if (/Mac OS X ([\d_\.]+)/i.test(s)) os = "macOS " + (s.match(/Mac OS X ([\d_\.]+)/i)?.[1].replace(/_/g, ".") ?? "");
  else if (/Android ([\d\.]+)/i.test(s)) os = "Android " + (s.match(/Android ([\d\.]+)/i)?.[1] ?? "");
  else if (/iPhone OS ([\d_]+)/i.test(s)) os = "iOS " + (s.match(/iPhone OS ([\d_]+)/i)?.[1].replace(/_/g, ".") ?? "");
  else if (/Linux/i.test(s)) os = "Linux";

  let browser = "—";
  if (/Edg\//i.test(s)) browser = "Edge";
  else if (/Chrome\/(\d+)/i.test(s)) browser = "Chrome " + (s.match(/Chrome\/(\d+)/i)?.[1] ?? "");
  else if (/Firefox\/(\d+)/i.test(s)) browser = "Firefox " + (s.match(/Firefox\/(\d+)/i)?.[1] ?? "");
  else if (/Safari\//i.test(s) && /Version\/(\d+)/i.test(s)) browser = "Safari " + (s.match(/Version\/(\d+)/i)?.[1] ?? "");

  let device = "Desktop";
  if (/iPhone/i.test(s)) device = "iPhone";
  else if (/iPad/i.test(s)) device = "iPad";
  else if (/Android.*Mobile/i.test(s)) device = "Android Phone";
  else if (/Android/i.test(s)) device = "Android Tablet";
  else if (/Mobile/i.test(s)) device = "Mobile";

  return { os, browser, device };
}

export function pushProvider(endpoint: string): string {
  if (/fcm\.googleapis|android\.com/i.test(endpoint)) return "FCM (Google)";
  if (/web\.push\.apple/i.test(endpoint)) return "APNs (Apple)";
  if (/mozilla\.com|autopush/i.test(endpoint)) return "Mozilla";
  if (/wns2|notify\.windows/i.test(endpoint)) return "WNS (Microsoft)";
  return "Other";
}
