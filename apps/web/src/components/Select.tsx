import { useEffect, useId, useMemo, useRef, useState } from "preact/hooks";
import { t } from "@coaching-app/shared/i18n";
import { Sheet } from "./ui";

export type SelectOption = { value: string; label: string; group?: string };

type Props = {
  id: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  searchable?: boolean;
};

const SEARCH_THRESHOLD = 8;
const POPOVER_MAX = 288;

type Placement = { top: number; left: number; width: number; up: boolean };

function Chevron() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
      <path d="M3.5 6l4.5 4.5L12.5 6" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  );
}

export function Select({ id, value, options, onChange, placeholder, disabled, searchable }: Props) {
  const listId = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const typed = useRef({ text: "", at: 0 });

  const [open, setOpen] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [placement, setPlacement] = useState<Placement | null>(null);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  const withSearch = searchable ?? options.length > SEARCH_THRESHOLD;
  const selected = options.find((o) => o.value === value);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle ? options.filter((o) => o.label.toLowerCase().includes(needle)) : options;
  }, [options, query]);

  const optionId = (index: number) => `${listId}-${index}`;

  function openMenu() {
    if (disabled) return;
    const rect = trigger.current?.getBoundingClientRect();
    const narrow = window.matchMedia("(max-width: 639px)").matches;
    setSheet(narrow);
    if (rect && !narrow) {
      const below = window.innerHeight - rect.bottom;
      setPlacement({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
        up: below < POPOVER_MAX && rect.top > below,
      });
    }
    setQuery("");
    setActive(Math.max(0, options.findIndex((o) => o.value === value)));
    setOpen(true);
  }

  function close(returnFocus = true) {
    setOpen(false);
    if (returnFocus) trigger.current?.focus();
  }

  function choose(index: number) {
    const option = visible[index];
    if (!option) return;
    onChange(option.value);
    close();
  }

  useEffect(() => {
    if (!open) return;
    (withSearch ? search.current : list.current)?.focus();
  }, [open, sheet]);

  useEffect(() => {
    if (open) document.getElementById(optionId(active))?.scrollIntoView({ block: "nearest" });
  }, [active, open, visible]);

  useEffect(() => {
    if (!open || sheet) return;
    const away = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node) && !list.current?.contains(event.target as Node)) close(false);
    };
    const dismiss = () => close(false);
    document.addEventListener("pointerdown", away);
    window.addEventListener("resize", dismiss);
    window.addEventListener("scroll", dismiss, true);
    return () => {
      document.removeEventListener("pointerdown", away);
      window.removeEventListener("resize", dismiss);
      window.removeEventListener("scroll", dismiss, true);
    };
  }, [open, sheet]);

  function onMenuKey(event: KeyboardEvent) {
    const last = visible.length - 1;
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setActive((i) => Math.min(last, i + 1));
        return;
      case "ArrowUp":
        event.preventDefault();
        setActive((i) => Math.max(0, i - 1));
        return;
      case "Home":
        event.preventDefault();
        setActive(0);
        return;
      case "End":
        event.preventDefault();
        setActive(Math.max(0, last));
        return;
      case "Enter":
        event.preventDefault();
        choose(active);
        return;
      case " ":
        if (!withSearch) {
          event.preventDefault();
          choose(active);
        }
        return;
      case "Escape":
        event.preventDefault();
        event.stopPropagation();
        close();
        return;
      case "Tab":
        close(false);
        return;
    }
    if (!withSearch && event.key.length === 1 && !event.ctrlKey && !event.metaKey) {
      const now = Date.now();
      const buffer = now - typed.current.at > 600 ? event.key : typed.current.text + event.key;
      typed.current = { text: buffer, at: now };
      const hit = visible.findIndex((o) => o.label.toLowerCase().startsWith(buffer.toLowerCase()));
      if (hit >= 0) setActive(hit);
    }
  }

  function onTriggerKey(event: KeyboardEvent) {
    if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
      event.preventDefault();
      openMenu();
    }
  }

  const menu = (
    <div class="select-menu" onKeyDown={onMenuKey}>
      {withSearch && (
        <input
          ref={search}
          class="input select-search"
          type="search"
          role="combobox"
          aria-expanded="true"
          aria-controls={listId}
          aria-activedescendant={visible.length ? optionId(active) : undefined}
          placeholder={t("select_search")}
          value={query}
          onInput={(e) => {
            setQuery(e.currentTarget.value);
            setActive(0);
          }}
        />
      )}
      <ul
        ref={list}
        id={listId}
        class="select-list"
        role="listbox"
        tabIndex={withSearch ? -1 : 0}
        aria-activedescendant={!withSearch && visible.length ? optionId(active) : undefined}
      >
        {visible.length === 0 && <li class="select-empty">{t("select_no_results")}</li>}
        {visible.map((option, index) => (
          <>
            {option.group && option.group !== visible[index - 1]?.group && (
              <li class="select-group" role="presentation">
                {option.group}
              </li>
            )}
            <li
              id={optionId(index)}
              key={option.value}
              role="option"
              class={index === active ? "select-opt active" : "select-opt"}
              aria-selected={option.value === value}
              onPointerMove={() => active !== index && setActive(index)}
              onClick={() => choose(index)}
            >
              {option.label}
            </li>
          </>
        ))}
      </ul>
    </div>
  );

  return (
    <div class="select" ref={root}>
      <button
        ref={trigger}
        id={id}
        type="button"
        class="input select-trigger"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        disabled={disabled}
        onClick={() => (open ? close() : openMenu())}
        onKeyDown={onTriggerKey}
      >
        <span class={selected ? "" : "muted"}>{selected?.label ?? placeholder ?? t("select_placeholder")}</span>
        <Chevron />
      </button>

      {open && sheet && <Sheet onClose={() => close()}>{menu}</Sheet>}
      {open && !sheet && placement && (
        <div
          class={placement.up ? "select-pop up" : "select-pop"}
          style={{
            left: `${placement.left}px`,
            width: `${placement.width}px`,
            ...(placement.up
              ? { bottom: `${window.innerHeight - placement.top + 8}px` }
              : { top: `${placement.top}px` }),
          }}
        >
          {menu}
        </div>
      )}
    </div>
  );
}
