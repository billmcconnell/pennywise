import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createCategory, deleteCategory, fetchCategories, type Category } from './api';

export function CategoriesPage() {
  const qc = useQueryClient();
  const catsQ = useQuery({
    queryKey: ['categories'],
    queryFn: fetchCategories,
    staleTime: 10 * 60 * 1000,
  });

  const create = useMutation({
    mutationFn: createCategory,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  });

  const remove = useMutation({
    mutationFn: deleteCategory,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categories'] });
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['by-category'] });
      qc.invalidateQueries({ queryKey: ['budget-status'] });
    },
  });

  const cats = catsQ.data ?? [];
  const topLevel = cats.filter((c) => !c.parentId && c.slug !== 'uncategorized');
  const byParent = new Map<string, Category[]>();
  for (const c of cats) {
    if (c.parentId) {
      const arr = byParent.get(c.parentId) ?? [];
      arr.push(c);
      byParent.set(c.parentId, arr);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <AddCategoryForm
        topLevel={topLevel}
        onSubmit={(name, parentId) => create.mutate({ name, parentId })}
        isPending={create.isPending}
        error={create.error as Error | null}
      />
      {catsQ.isLoading && <p className="text-zinc-500">Loading…</p>}
      {topLevel.map((parent) => (
        <CategoryGroup
          key={parent.id}
          parent={parent}
          children={byParent.get(parent.id) ?? []}
          onDelete={(id) => remove.mutate(id)}
          isPending={remove.isPending}
        />
      ))}
    </div>
  );
}

function AddCategoryForm(props: {
  topLevel: Category[];
  onSubmit: (name: string, parentId: string) => void;
  isPending: boolean;
  error: Error | null;
}) {
  const [name, setName] = useState('');
  const [parentId, setParentId] = useState('');

  return (
    <form
      className="flex flex-wrap items-end gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim() || !parentId) return;
        props.onSubmit(name.trim(), parentId);
        setName('');
      }}
    >
      <Field label="Parent category">
        <select
          required
          className="rounded-xl border border-zinc-300 px-2 py-1 text-sm"
          value={parentId}
          onChange={(e) => setParentId(e.target.value)}
        >
          <option value="">— choose —</option>
          {props.topLevel.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Sub-category name">
        <input
          required
          placeholder="e.g. Gym"
          className="rounded-xl border border-zinc-300 px-2 py-1 text-sm"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </Field>
      <button
        type="submit"
        disabled={props.isPending || !name.trim() || !parentId}
        className="rounded bg-emerald-500 px-3 py-1 text-sm text-white hover:bg-emerald-600 disabled:opacity-50"
      >
        {props.isPending ? 'Adding…' : 'Add sub-category'}
      </button>
      {props.error && <span className="text-sm text-red-600">{props.error.message}</span>}
    </form>
  );
}

function CategoryGroup(props: {
  parent: Category;
  children: Category[];
  onDelete: (id: string) => void;
  isPending: boolean;
}) {
  return (
    <div className="rounded-xl border border-zinc-200">
      <div className="border-b border-zinc-100 bg-zinc-50 px-3 py-2 text-sm font-semibold text-zinc-700">
        {props.parent.name}
      </div>
      <ul className="divide-y divide-zinc-100">
        {props.children.length === 0 && (
          <li className="px-3 py-2 text-sm text-zinc-400">No sub-categories.</li>
        )}
        {props.children.map((c) => (
          <li key={c.id} className="flex items-center justify-between px-3 py-2">
            <span className="text-sm">{c.name}</span>
            {c.isSystem ? (
              <span className="text-xs text-zinc-400">system</span>
            ) : (
              <button
                type="button"
                disabled={props.isPending}
                onClick={() => {
                  if (
                    confirm(
                      `Delete "${c.name}"? Transactions will move to ${props.parent.name}.`,
                    )
                  )
                    props.onDelete(c.id);
                }}
                className="rounded bg-zinc-200 px-2 py-1 text-xs text-zinc-800 disabled:opacity-40"
              >
                Delete
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Field(props: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-zinc-600">{props.label}</span>
      {props.children}
    </label>
  );
}
