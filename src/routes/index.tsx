import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from 'react';
import { coachBridge } from '@/lib/coach-access';

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Liberi Tutti – Registro Allenamenti" },
      { name: "description", content: "Registro allenamenti di Liberi Tutti: calendario, presenze e sessioni." },
      { property: "og:title", content: "Liberi Tutti – Registro Allenamenti" },
      { property: "og:description", content: "Registro allenamenti di Liberi Tutti." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

function Index() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const host = window as unknown as { LTCloud?: typeof coachBridge };
    host.LTCloud = coachBridge;
    setReady(true);
    return () => { delete host.LTCloud; };
  }, []);
  if (!ready) return null;
  return (
    <iframe
      src="/app.html"
      title="Liberi Tutti – Registro Allenamenti"
      className="fixed inset-0 h-full w-full border-0"
    />
  );
}
