import { t } from "@coaching-app/shared/i18n";
import { driveEmbedUrl, driveOpenUrl } from "../lib/drive";
import { pick } from "../lib/format";
import type { BatchNote } from "../lib/types";
import { Sheet } from "./ui";

/** Opens a note/DPP right inside the app (an embedded Drive viewer) instead of
 * sending the student to a new browser tab. "Open in Drive" stays underneath
 * as a fallback for the rare file Drive won't preview inline. */
export function MaterialViewer({ note, onClose }: { note: BatchNote; onClose: () => void }) {
  return (
    <Sheet onClose={onClose}>
      <h2 class="subtitle">{pick(note, "title")}</h2>
      <div class="material-frame">
        <iframe src={driveEmbedUrl(note.drive_file_id)} title={pick(note, "title")} allow="autoplay" />
      </div>
      <a class="btn quiet block" href={driveOpenUrl(note.drive_file_id)} target="_blank" rel="noopener noreferrer">
        {t("material_open_drive")}
      </a>
    </Sheet>
  );
}
