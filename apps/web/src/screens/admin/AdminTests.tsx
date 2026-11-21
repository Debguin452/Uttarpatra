import { useEffect, useState } from "preact/hooks";
import { t } from "@coaching-app/shared/i18n";
import { TestUpsert } from "@coaching-app/shared/schema";
import { ConfirmSheet, Field, Segmented } from "../../components/adminUi";
import { Select } from "../../components/Select";
import { Loading } from "../../components/ui";
import { api, ApiError } from "../../lib/api";
import type { AdminBatchRow, AdminTestDetail, AdminTestQuestion, AdminTestRow } from "../../lib/adminTypes";
import { errorText, pick, when } from "../../lib/format";
import { useLoad } from "../../lib/useLoad";
import { AiQuestionGenerator } from "../../components/AiQuestionGenerator";
import { useSubjects } from "../../lib/queries";
import { subjectNames } from "../../lib/subjects";

const KINDS: AdminTestRow["kind"][] = ["full_mock", "chapter", "daily_quiz", "pyq", "scholarship"];
const STATUSES: AdminTestRow["status"][] = ["draft", "scheduled", "live", "closed"];
const QTYPES: AdminTestQuestion["type"][] = ["mcq", "assertion_reason", "true_false", "match", "case_based"];

const toLocalInput = (unixSec: number | null): string => {
  if (!unixSec) return "";
  const d = new Date(unixSec * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const toUnixSec = (local: string): number | null => (local ? Math.round(new Date(local).getTime() / 1000) : null);

type Meta = {
  batchId: string;
  titleBn: string;
  titleEn: string;
  kind: AdminTestRow["kind"];
  durationMin: string;
  totalMarks: string;
  negativeMark: string;
  opensAt: string;
  closesAt: string;
  status: AdminTestRow["status"];
};

const EMPTY_META: Meta = {
  batchId: "",
  titleBn: "",
  titleEn: "",
  kind: "chapter",
  durationMin: "30",
  totalMarks: "40",
  negativeMark: "1",
  opensAt: "",
  closesAt: "",
  status: "draft",
};

function parseBulk(text: string, defaultMarks: number): { rows: AdminTestQuestion[]; rejected: number } {
  const rows: AdminTestQuestion[] = [];
  let rejected = 0;
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const parts = trimmed.split("|").map((p) => p.trim());
    if (parts.length < 5) {
      rejected++;
      continue;
    }
    const [subject, type, prompt, optionsStr, answer, marksStr] = parts;
    const options = (optionsStr ?? "").split(";").map((o) => o.trim()).filter(Boolean);
    if (!subject || !prompt || !answer || options.length < 2) {
      rejected++;
      continue;
    }
    rows.push({
      subject,
      type: type && (QTYPES as string[]).includes(type) ? (type as AdminTestQuestion["type"]) : "mcq",
      prompt,
      options,
      answer,
      marks: Number.parseFloat(marksStr ?? "") || defaultMarks,
    });
  }
  return { rows, rejected };
}

function TestEditor({ testId, batches, onDone, onCancel }: { testId: string | null; batches: AdminBatchRow[]; onDone: () => void; onCancel: () => void }) {
  const detail = useLoad<AdminTestDetail | null>(() => (testId ? api<AdminTestDetail>(`/api/admin/tests/${testId}`) : Promise.resolve(null)), [testId]);
  const subjects = useSubjects();

  const [meta, setMeta] = useState<Meta>(EMPTY_META);
  const [questions, setQuestions] = useState<AdminTestQuestion[]>([]);
  const [ready, setReady] = useState(testId === null);
  const [bulkText, setBulkText] = useState("");
  const [bulkNote, setBulkNote] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (testId && detail.data && !ready) {
      const d = detail.data;
      setMeta({
        batchId: d.batch_id ?? "",
        titleBn: d.title_bn,
        titleEn: d.title_en,
        kind: d.kind,
        durationMin: String(Math.round(d.duration_sec / 60)),
        totalMarks: String(d.total_marks),
        negativeMark: String(d.negative_mark),
        opensAt: toLocalInput(d.opens_at),
        closesAt: toLocalInput(d.closes_at),
        status: d.status,
      });
      setQuestions(JSON.parse(d.questions_json) as AdminTestQuestion[]);
      setReady(true);
    }
  }, [testId, detail.data, ready]);

  function updateQuestion(index: number, changes: Partial<AdminTestQuestion>) {
    setQuestions((rows) => rows.map((row, i) => (i === index ? { ...row, ...changes } : row)));
  }
  function removeQuestion(index: number) {
    setQuestions((rows) => rows.filter((_, i) => i !== index));
  }
  function addBlankQuestion() {
    setQuestions((rows) => [
      ...rows,
      { subject: subjects.data?.[0]?.id ?? "", type: "mcq", prompt: "", options: ["", ""], answer: "", marks: 4 },
    ]);
  }
  function addBulk() {
    const { rows, rejected } = parseBulk(bulkText, 4);
    setQuestions((current) => [...current, ...rows]);
    setBulkNote(t("admin_bulk_result", { added: rows.length, rejected }));
    if (rows.length) setBulkText("");
  }

  async function save() {
    const parsed = TestUpsert.safeParse({
      batchId: meta.batchId || null,
      titleBn: meta.titleBn,
      titleEn: meta.titleEn,
      kind: meta.kind,
      durationSec: (Number.parseInt(meta.durationMin, 10) || 0) * 60,
      totalMarks: Number.parseInt(meta.totalMarks, 10) || 0,
      negativeMark: Number.parseFloat(meta.negativeMark) || 0,
      questions: questions.map(({ subject, type, prompt, options, answer, marks }) => ({ subject, type, prompt, options, answer, marks })),
      opensAt: toUnixSec(meta.opensAt),
      closesAt: toUnixSec(meta.closesAt),
      status: meta.status,
    });
    if (!parsed.success) {
      setErrors(parsed.error.flatten().fieldErrors);
      setFailure(t("admin_fix_errors"));
      return;
    }
    setErrors({});
    setFailure(null);
    setBusy(true);
    try {
      if (testId) await api(`/api/admin/tests/${testId}`, { method: "PUT", body: parsed.data });
      else await api("/api/admin/tests", { body: parsed.data });
      onDone();
    } catch (e) {
      setFailure(errorText(e instanceof ApiError ? e.code : "network"));
    }
    setBusy(false);
  }

  const problem = (key: string) => errors[key]?.[0];

  if (testId && (detail.loading || !ready)) return <Loading />;
  if (testId && detail.error) return <p class="error-text">{detail.error}</p>;

  return (
    <div class="stack">
      <div class="row-between">
        <h1 class="title">{testId ? t("admin_edit_test") : t("admin_new_test")}</h1>
        <button class="btn small quiet" onClick={onCancel}>
          {t("back")}
        </button>
      </div>

      <section class="stack">
        <Field id="t-title-en" label={t("admin_title_en")} error={problem("titleEn")}>
          <input id="t-title-en" class="input" value={meta.titleEn} onInput={(e) => setMeta((m) => ({ ...m, titleEn: e.currentTarget.value }))} />
        </Field>
        <Field id="t-title-bn" label={t("admin_title_bn")} error={problem("titleBn")}>
          <input id="t-title-bn" class="input" value={meta.titleBn} onInput={(e) => setMeta((m) => ({ ...m, titleBn: e.currentTarget.value }))} />
        </Field>
        <Field id="t-batch" label={t("admin_audience")} hint={t("admin_test_batch_hint")}>
          <Select
            id="t-batch"
            value={meta.batchId}
            onChange={(batchId) => setMeta((m) => ({ ...m, batchId }))}
            options={[{ value: "", label: t("admin_audience_all") }, ...batches.map((b) => ({ value: b.id, label: pick(b, "title") }))]}
          />
        </Field>
        <Field label={t("admin_test_kind")}>
          <Segmented label={t("admin_test_kind")} value={meta.kind} onChange={(kind) => setMeta((m) => ({ ...m, kind }))} options={KINDS.map((k) => ({ id: k, label: t(`test_kind_${k}`) }))} />
        </Field>
        <Field id="t-duration" label={t("admin_duration_min")} error={problem("durationSec")}>
          <input
            id="t-duration"
            class="input"
            inputMode="numeric"
            value={meta.durationMin}
            onInput={(e) => setMeta((m) => ({ ...m, durationMin: e.currentTarget.value.replace(/[^0-9]/g, "") }))}
          />
        </Field>
        <Field id="t-marks" label={t("admin_test_total_marks")} error={problem("totalMarks")}>
          <input
            id="t-marks"
            class="input"
            inputMode="numeric"
            value={meta.totalMarks}
            onInput={(e) => setMeta((m) => ({ ...m, totalMarks: e.currentTarget.value.replace(/[^0-9]/g, "") }))}
          />
        </Field>
        <Field id="t-neg" label={t("admin_test_negative_mark")} hint={t("admin_test_negative_mark_hint")}>
          <input id="t-neg" class="input" inputMode="decimal" value={meta.negativeMark} onInput={(e) => setMeta((m) => ({ ...m, negativeMark: e.currentTarget.value }))} />
        </Field>
        <Field id="t-opens" label={t("admin_test_opens_at")}>
          <input id="t-opens" class="input" type="datetime-local" value={meta.opensAt} onInput={(e) => setMeta((m) => ({ ...m, opensAt: e.currentTarget.value }))} />
        </Field>
        <Field id="t-closes" label={t("admin_test_closes_at")}>
          <input id="t-closes" class="input" type="datetime-local" value={meta.closesAt} onInput={(e) => setMeta((m) => ({ ...m, closesAt: e.currentTarget.value }))} />
        </Field>
        <Field label={t("admin_visibility")}>
          <Segmented
            label={t("admin_visibility")}
            value={meta.status}
            onChange={(status) => setMeta((m) => ({ ...m, status }))}
            options={STATUSES.map((s) => ({ id: s, label: t(`test_status_${s}`) }))}
          />
        </Field>
      </section>

      <section class="stack">
        <h2 class="subtitle">{t("admin_test_questions", { count: questions.length })}</h2>
        {problem("questions") && <p class="error-text">{problem("questions")}</p>}

        {questions.map((q, i) => (
          <div class="panel" key={i}>
            <div class="row-between">
              <strong class="small">{t("admin_test_question_n", { n: i + 1 })}</strong>
              <button class="btn small danger" onClick={() => removeQuestion(i)}>
                {t("admin_delete")}
              </button>
            </div>
            <div class="stack">
              <Field label={t("doubt_subject")}>
                <Select
                  id={`q-${i}-subject`}
                  value={q.subject}
                  onChange={(subject) => updateQuestion(i, { subject })}
                  options={(subjects.data ?? []).map((s) => ({ value: s.id, label: pick(s, "name") }))}
                />
              </Field>
              <Field label={t("admin_question_type")}>
                <Select
                  id={`q-${i}-type`}
                  value={q.type}
                  onChange={(type) => updateQuestion(i, { type: type as AdminTestQuestion["type"] })}
                  options={QTYPES.map((qt) => ({ value: qt, label: t(`qtype_${qt}`) }))}
                />
              </Field>
              <Field label={t("admin_question_prompt")}>
                <textarea class="input" rows={2} value={q.prompt} onInput={(e) => updateQuestion(i, { prompt: (e.currentTarget as HTMLTextAreaElement).value })} />
              </Field>
              {q.options.map((opt, oi) => (
                <div class="row" style="display:flex;gap:8px;align-items:center" key={oi}>
                  <input
                    class="input"
                    value={opt}
                    placeholder={t("admin_question_option_n", { n: oi + 1 })}
                    onInput={(e) => {
                      const options = [...q.options];
                      options[oi] = e.currentTarget.value;
                      updateQuestion(i, { options });
                    }}
                  />
                  {q.options.length > 2 && (
                    <button class="btn small quiet" onClick={() => updateQuestion(i, { options: q.options.filter((_, idx) => idx !== oi) })}>
                      {t("admin_delete")}
                    </button>
                  )}
                </div>
              ))}
              {q.options.length < 6 && (
                <button class="btn small quiet" onClick={() => updateQuestion(i, { options: [...q.options, ""] })}>
                  {t("admin_question_add_option")}
                </button>
              )}
              <Field label={t("admin_question_answer")} hint={t("admin_question_answer_hint")}>
                <input class="input" value={q.answer} onInput={(e) => updateQuestion(i, { answer: e.currentTarget.value })} />
              </Field>
              <Field label={t("admin_question_marks")}>
                <input
                  class="input"
                  inputMode="decimal"
                  value={String(q.marks)}
                  onInput={(e) => updateQuestion(i, { marks: Number.parseFloat(e.currentTarget.value) || 0 })}
                />
              </Field>
            </div>
          </div>
        ))}

        <button class="btn" onClick={addBlankQuestion}>
          {t("admin_question_add")}
        </button>

        <AiQuestionGenerator
          subjects={subjects.data ?? []}
          onAdd={(rows) => setQuestions((current) => [...current, ...rows])}
        />

        <div class="panel stack">
          <strong class="small">{t("admin_bulk_title")}</strong>
          <p class="small muted" style="white-space:pre-wrap">
            {t("admin_bulk_hint")}
          </p>
          <textarea class="input" rows={4} value={bulkText} onInput={(e) => setBulkText((e.currentTarget as HTMLTextAreaElement).value)} />
          <button class="btn small" onClick={addBulk} disabled={!bulkText.trim()}>
            {t("admin_bulk_add")}
          </button>
          {bulkNote && <p class="small muted">{bulkNote}</p>}
        </div>
      </section>

      {failure && <p class="error-text">{failure}</p>}
      <button class="btn primary block" onClick={save} disabled={busy}>
        {t("save")}
      </button>
    </div>
  );
}

export function AdminTests() {
  const [batchFilter, setBatchFilter] = useState("");
  const [editing, setEditing] = useState<"list" | "new" | string>("list");
  const list = useLoad(() => api<AdminTestRow[]>(`/api/admin/tests${batchFilter ? `?batchId=${encodeURIComponent(batchFilter)}` : ""}`), [batchFilter]);
  const batches = useLoad(() => api<AdminBatchRow[]>("/api/admin/batches"));
  const [deleting, setDeleting] = useState<AdminTestRow | null>(null);
  const [busy, setBusy] = useState(false);

  async function remove() {
    if (!deleting) return;
    setBusy(true);
    try {
      await api(`/api/admin/tests/${deleting.id}`, { method: "DELETE" });
      setDeleting(null);
      await list.reload();
    } catch {
      // surfaced via the sheet remaining open is enough signal here
    }
    setBusy(false);
  }

  if (editing !== "list") {
    return (
      <TestEditor
        testId={editing === "new" ? null : editing}
        batches={batches.data ?? []}
        onDone={() => {
          setEditing("list");
          void list.reload();
        }}
        onCancel={() => setEditing("list")}
      />
    );
  }

  return (
    <div class="stack">
      <div class="row-between">
        <h1 class="title">{t("admin_tab_tests")}</h1>
        <button class="btn primary" onClick={() => setEditing("new")}>
          {t("admin_new_test")}
        </button>
      </div>

      <div class="field">
        <label for="test-batch">{t("admin_audience")}</label>
        <Select
          id="test-batch"
          value={batchFilter}
          onChange={setBatchFilter}
          options={[{ value: "", label: t("admin_audience_all") }, ...(batches.data ?? []).map((b) => ({ value: b.id, label: pick(b, "title") }))]}
        />
      </div>

      {list.error && <p class="error-text">{list.error}</p>}
      {list.loading && !list.data && <Loading />}
      {list.data && list.data.length === 0 && <p class="muted small">{t("admin_no_tests")}</p>}

      <div class="list">
        {(list.data ?? []).map((test) => (
          <div class="item" key={test.id}>
            <span class="name">{pick(test, "title")}</span>
            <span class="meta">
              {t(`test_kind_${test.kind}`)} · {t(`test_status_${test.status}`)} · {t("admin_test_attempts", { count: test.attempt_count })}
              {test.batch_title_en ? ` · ${test.batch_title_en}` : ` · ${t("admin_audience_all")}`}
              {test.opens_at ? ` · ${when(test.opens_at)}` : ""}
            </span>
            <span class="side" style="flex-direction:column;align-items:stretch;gap:6px">
              <button class="btn small quiet" onClick={() => setEditing(test.id)}>
                {t("edit")}
              </button>
              <button class="btn small danger" onClick={() => setDeleting(test)}>
                {t("admin_delete")}
              </button>
            </span>
          </div>
        ))}
      </div>

      {deleting && (
        <ConfirmSheet
          title={t("admin_delete_test_title")}
          body={t("admin_delete_test_body")}
          confirmLabel={t("admin_delete")}
          danger
          busy={busy}
          onConfirm={remove}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  );
}
