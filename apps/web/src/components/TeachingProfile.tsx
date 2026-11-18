import { useEffect, useState } from "preact/hooks";
import { t } from "@coaching-app/shared/i18n";
import { TeacherProfileUpdate } from "@coaching-app/shared/schema";
import { api, ApiError } from "../lib/api";
import { errorText } from "../lib/format";
import type { TeacherPortal } from "../lib/types";
import { useLoad } from "../lib/useLoad";
import { SectionHead } from "./ui";

// Lets a teacher keep the profile students see on their batches up to date:
// qualification, experience, about, demo link and contact number.
export function TeachingProfile() {
  const portal = useLoad(() => api<TeacherPortal>("/api/teacher-application"));
  const application = portal.data?.application ?? null;

  const [qualification, setQualification] = useState("");
  const [experience, setExperience] = useState("");
  const [phone, setPhone] = useState("");
  const [bio, setBio] = useState("");
  const [demo, setDemo] = useState("");
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!application) return;
    setQualification(application.qualification);
    setExperience(String(application.experience_years));
    setPhone(application.phone);
    setBio(application.bio);
    setDemo(application.demo_url ?? "");
  }, [application?.qualification, application?.bio, application?.phone, application?.experience_years, application?.demo_url]);

  if (!portal.data?.isTeacher) return null;

  async function submit(event: Event) {
    event.preventDefault();
    setSaved(false);
    const parsed = TeacherProfileUpdate.safeParse({
      qualification,
      experienceYears: experience === "" ? undefined : Number(experience),
      phone,
      bio,
      demoUrl: demo.trim() || undefined,
    });
    if (!parsed.success) {
      setErrors(parsed.error.flatten().fieldErrors);
      return;
    }
    setErrors({});
    setFailure(null);
    setBusy(true);
    try {
      await api("/api/teacher-application/profile", { method: "PUT", body: parsed.data });
      setSaved(true);
      await portal.reload();
    } catch (e) {
      setFailure(errorText(e instanceof ApiError ? e.code : "network"));
    }
    setBusy(false);
  }

  const problem = (key: string) => errors[key]?.[0];

  return (
    <section class="stack">
      <SectionHead title={t("teach_profile_title")} />
      <p class="muted small">{t("teach_profile_hint")}</p>
      <form class="stack" onSubmit={submit}>
        <div class="field">
          <label for="tp-qualification">{t("teach_qualification")}</label>
          <input id="tp-qualification" class="input" value={qualification} onInput={(e) => setQualification(e.currentTarget.value)} />
          {problem("qualification") && <span class="error-text">{problem("qualification")}</span>}
        </div>
        <div class="field">
          <label for="tp-experience">{t("teach_experience")}</label>
          <input
            id="tp-experience"
            class="input"
            inputMode="numeric"
            value={experience}
            onInput={(e) => setExperience(e.currentTarget.value.replace(/[^0-9]/g, ""))}
          />
          {problem("experienceYears") && <span class="error-text">{problem("experienceYears")}</span>}
        </div>
        <div class="field">
          <label for="tp-phone">{t("mobile")}</label>
          <input id="tp-phone" class="input" inputMode="numeric" maxLength={10} value={phone} onInput={(e) => setPhone(e.currentTarget.value)} />
          {problem("phone") && <span class="error-text">{problem("phone")}</span>}
        </div>
        <div class="field">
          <label for="tp-bio">{t("teach_bio")}</label>
          <textarea
            id="tp-bio"
            class="input"
            rows={5}
            maxLength={600}
            value={bio}
            onInput={(e) => setBio((e.currentTarget as HTMLTextAreaElement).value)}
          />
          <span class="hint">
            {t("teach_bio_hint")} {bio.length}/600
          </span>
          {problem("bio") && <span class="error-text">{problem("bio")}</span>}
        </div>
        <div class="field">
          <label for="tp-demo">{t("teach_demo")}</label>
          <input id="tp-demo" class="input" type="url" value={demo} onInput={(e) => setDemo(e.currentTarget.value)} />
          {problem("demoUrl") && <span class="error-text">{problem("demoUrl")}</span>}
        </div>
        {failure && <p class="error-text">{failure}</p>}
        {saved && <p class="notice small">{t("profile_saved")}</p>}
        <button class="btn primary block" type="submit" disabled={busy}>
          {t("save")}
        </button>
      </form>
    </section>
  );
}
