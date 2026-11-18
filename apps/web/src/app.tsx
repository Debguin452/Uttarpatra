import { Nav } from "./components/Nav";
import { Splash } from "./components/ui";
import { fatal } from "./lib/api";
import { AvatarFirstRun } from "./components/AvatarSheet";
import { segments } from "./lib/router";
import { authUser, me, meError } from "./lib/session";
import { loadMe } from "./lib/session";
import { Batches } from "./screens/Batches";
import { BatchDetail } from "./screens/BatchDetail";
import { Doubt } from "./screens/Doubt";
import { Enroll } from "./screens/Enroll";
import { Fatal } from "./screens/Fatal";
import { Home } from "./screens/Home";
import { Login } from "./screens/Login";
import { Welcome } from "./screens/Welcome";
import { RoleSelect } from "./screens/RoleSelect";
import { awaitingRoleChoice, signupIntent, welcomeSeen } from "./lib/onboarding";
import { Profile } from "./screens/Profile";
import { Register } from "./screens/Register";
import { TestRunner } from "./screens/TestRunner";
import { TestResult } from "./screens/TestResult";
import { Tests } from "./screens/Tests";
import { TeacherApply } from "./screens/TeacherApply";
import { t } from "@coaching-app/shared/i18n";
import { lazyScreen } from "./components/lazyScreen";

const AdminShell = lazyScreen<Record<string, never>>(() =>
  import("./screens/admin/AdminShell").then((m) => m.AdminShell as never),
);

const TeacherShell = lazyScreen<Record<string, never>>(() =>
  import("./screens/teacher/TeacherShell").then((m) => m.TeacherShell as never),
);

function Screen({ pendingTeacher }: { pendingTeacher: boolean }) {
  const [head, arg] = segments();
  if (pendingTeacher && head !== "profile") return <TeacherApply />;
  switch (head) {
    case "batches":
      return arg ? <BatchDetail batchId={arg} /> : <Batches />;
    case "enroll":
      return arg ? <Enroll batchId={arg} /> : <Batches />;
    case "tests":
      if (!arg) return <Tests />;
      return segments()[2] === "result" ? <TestResult testId={arg} /> : <TestRunner testId={arg} />;
    case "teach":
      return <TeacherApply />;
    case "doubt":
      return <Doubt />;
    case "profile":
      return arg === "edit" ? <Register mode="edit" /> : <Profile />;
    default:
      return <Home />;
  }
}

export function App() {
  // Privacy and Terms live only in the static pages /privacy.html and
  // /terms.html. Old #/privacy and #/terms links forward there.
  const legal = segments()[0];
  if (legal === "privacy" || legal === "terms") {
    location.replace(`/${legal}.html`);
    return <Splash />;
  }

  if (fatal.value) return <Fatal />;

  const user = authUser.value;
  if (user === undefined) return <Splash />;
  if (user === null) {
    if (awaitingRoleChoice.value) return <RoleSelect />;
    return welcomeSeen.value ? <Login /> : <Welcome />;
  }

  const profile = me.value;
  if (!profile) {
    if (!meError.value) return <Splash />;
    return (
      <main class="center">
        <p class="error-text">{t("something_wrong")}</p>
        <button class="btn block" onClick={loadMe}>
          {t("retry")}
        </button>
      </main>
    );
  }
  if (!profile.registered) return <Register mode="create" intent={signupIntent.value} />;

  if (profile.user.role === "support" || profile.user.role === "super_admin") {
    return (
      <>
        <AdminShell />
        <AvatarFirstRun />
      </>
    );
  }
  if (profile.user.role === "teacher") {
    return (
      <>
        <TeacherShell />
        <AvatarFirstRun />
      </>
    );
  }

  const pendingTeacher = profile.user.role === "student" && signupIntent.value === "teacher";
  const running = segments()[0] === "tests" && Boolean(segments()[1]) && segments()[2] !== "result";
  return (
    <div class={running ? "app bare" : "app"}>
      <Screen pendingTeacher={pendingTeacher} />
      {!running && <Nav restricted={pendingTeacher} />}
      <AvatarFirstRun />
    </div>
  );
}
