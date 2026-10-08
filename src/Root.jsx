import { lazy, Suspense } from "react";
import App from "./App.jsx";

// Eltern-Link zur Zu-/Absage (…/?zusage=<id>) öffnet direkt die Abstimmung, ohne Startseite und Anmeldung
const AttendancePublic = lazy(() => import("./components/AttendancePublic.jsx"));

export default function Root() {
  const attendanceId = new URLSearchParams(window.location.search).get("zusage");
  if (!attendanceId) return <App />;
  return (
    <Suspense fallback={null}>
      <AttendancePublic eventId={attendanceId} />
    </Suspense>
  );
}
