import { Nav } from "./components/Nav";
import { Splash } from "./components/ui";
import { fatal } from "./lib/api";
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
import { welcomeSeen } from "./lib/onboarding";
import { Profile } from "./screens/Profile";
import { Register } from "./screens/Register";
import { TestRunner } from "./screens/TestRunner";
import { Tests } from "./screens/Tests";
import { t } from "@coaching-app/shared/i18n";

function Screen() {
  const [head, arg] = segments();
  switch (head) {
    case "batches":
      return arg ? <BatchDetail batchId={arg} /> : <Batches />;
    case "enroll":
      return arg ? <Enroll batchId={arg} /> : <Batches />;
    case "tests":
      return arg ? <TestRunner testId={arg} /> : <Tests />;
    case "doubt":
      return <Doubt />;
    case "profile":
      return arg === "edit" ? <Register mode="edit" /> : <Profile />;
    default:
      return <Home />;
  }
}

export function App() {
  if (fatal.value) return <Fatal />;

  const user = authUser.value;
  if (user === undefined) return <Splash />;
  if (user === null) return welcomeSeen.value ? <Login /> : <Welcome />;

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
  if (!profile.registered) return <Register mode="create" />;

  const running = segments()[0] === "tests" && Boolean(segments()[1]);
  return (
    <div class={running ? "app bare" : "app"}>
      <Screen />
      {!running && <Nav />}
    </div>
  );
}
