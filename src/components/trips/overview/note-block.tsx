"use client";

import { Placeholder } from "@tiptap/extensions";
import { EditorContent, useEditor, useEditorState, type Editor, type JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Bold, Heading3, Italic, List, ListOrdered } from "lucide-react";
import type { Json } from "@/lib/supabase/database.types";
import type { NoteContent } from "@/lib/trip-blocks";
import { cn } from "@/lib/utils";

function initialDoc(content: NoteContent): JSONContent {
  if (content.doc && typeof content.doc === "object" && !Array.isArray(content.doc)) {
    return content.doc as JSONContent;
  }
  return {
    type: "doc",
    content: content.text.split("\n").map((line) => ({
      type: "paragraph",
      content: line ? [{ type: "text", text: line }] : [],
    })),
  };
}

export function NoteBlockBody({
  content,
  canEdit,
  onChange,
}: {
  content: NoteContent;
  canEdit: boolean;
  onChange: (content: NoteContent) => void;
}) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [3] }, codeBlock: false, horizontalRule: false }),
      Placeholder.configure({ placeholder: canEdit ? "Write anything: ideas, tips, reminders…" : "" }),
    ],
    content: initialDoc(content),
    editable: canEdit,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "note-content min-h-12 outline-none",
        "aria-label": "Note",
      },
    },
    onUpdate: ({ editor }) => {
      onChange({ text: editor.getText({ blockSeparator: "\n" }), doc: editor.getJSON() as Json });
    },
  });

  if (!editor) {
    return <div className="note-content min-h-12 whitespace-pre-wrap">{content.text}</div>;
  }

  return (
    <div className="flex flex-col gap-2">
      {canEdit ? <Toolbar editor={editor} /> : null}
      <EditorContent editor={editor} />
    </div>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const state = useEditorState({
    editor,
    selector: ({ editor }) => ({
      bold: editor.isActive("bold"),
      italic: editor.isActive("italic"),
      heading: editor.isActive("heading", { level: 3 }),
      bulletList: editor.isActive("bulletList"),
      orderedList: editor.isActive("orderedList"),
    }),
  });

  const buttons = [
    { key: "bold", label: "Bold", icon: Bold, run: () => editor.chain().focus().toggleBold().run() },
    { key: "italic", label: "Italic", icon: Italic, run: () => editor.chain().focus().toggleItalic().run() },
    {
      key: "heading",
      label: "Heading",
      icon: Heading3,
      run: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
    },
    {
      key: "bulletList",
      label: "Bulleted list",
      icon: List,
      run: () => editor.chain().focus().toggleBulletList().run(),
    },
    {
      key: "orderedList",
      label: "Numbered list",
      icon: ListOrdered,
      run: () => editor.chain().focus().toggleOrderedList().run(),
    },
  ] as const;

  return (
    <div role="toolbar" aria-label="Formatting" className="-ml-1 flex gap-0.5">
      {buttons.map(({ key, label, icon: Icon, run }) => (
        <button
          key={key}
          type="button"
          aria-label={label}
          aria-pressed={state[key]}
          onMouseDown={(event) => event.preventDefault()}
          onClick={run}
          className={cn(
            "flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground",
            state[key] && "bg-muted text-foreground",
          )}
        >
          <Icon className="size-3.5" />
        </button>
      ))}
    </div>
  );
}
