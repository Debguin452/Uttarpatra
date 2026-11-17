import { t } from "@coaching-app/shared/i18n";
import { pick } from "../lib/format";
import { useBatchTeachers } from "../lib/queries";
import { Avatar } from "./Avatar";
import { SectionHead } from "./ui";

// The teachers assigned to a batch. Renders nothing while loading, when
// offline with no saved copy, or when none are assigned yet.
export function TeacherCards({ batchId }: { batchId: string }) {
  const teachers = useBatchTeachers(batchId).data ?? [];
  if (teachers.length === 0) return null;

  return (
    <section class="stack">
      <SectionHead title={t("teachers_title")} />
      <div class="teacher-list">
        {teachers.map((teacher) => {
          const subject = pick(teacher, "subject");
          const facts = [
            teacher.qualification,
            teacher.experience_years ? t("teacher_experience", { years: teacher.experience_years }) : null,
          ].filter(Boolean);
          return (
            <article class="teacher-card" key={`${teacher.name}-${subject}`}>
              <Avatar photo={teacher.photo_url} name={teacher.name} size={56} />
              <div class="teacher-body">
                <h3 class="teacher-name">{teacher.name}</h3>
                {subject && <p class="eyebrow">{subject}</p>}
                {facts.length > 0 && <p class="muted small">{facts.join(" · ")}</p>}
                {teacher.bio && <p class="teacher-bio">{teacher.bio}</p>}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
