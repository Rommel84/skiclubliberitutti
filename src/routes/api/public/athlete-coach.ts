import { createFileRoute } from "@tanstack/react-router";

import { handleAthleteCoach } from "@/lib/ai/coach.server";

export const Route = createFileRoute("/api/public/athlete-coach")({
  server: {
    handlers: {
      POST: ({ request }) => handleAthleteCoach(request),
    },
  },
});
