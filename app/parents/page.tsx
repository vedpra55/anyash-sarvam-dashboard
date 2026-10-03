"use client";

import React, { Suspense, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ParentsListColumn } from "@/components/anyash/ParentsListColumn";
import { ParentDetailCanvas } from "@/components/anyash/ParentDetailCanvas";
import { useParents } from "@/components/anyash/useParents";
import { useParentActions } from "@/components/anyash/useParentActions";
import { Button, EmptyState } from "@/components/anyash/primitives";
import { ParentListSkeleton, ParentDetailSkeleton, Bone } from "@/components/anyash/Skeletons";
import { getParentStatus } from "@/lib/attention";

function LoadingView({ withDetail }: { withDetail: boolean }) {
  return (
    <>
      <div className={`w-full lg:w-[320px] shrink-0 lg:border-r border-ay-line pt-6 ${withDetail ? "hidden lg:block" : ""}`}>
        <div className="px-5 pb-5 flex items-center justify-between">
          <h1 className="text-[20px] font-semibold text-white tracking-tight">Parents</h1>
          <Bone className="h-8 w-16 rounded-full" />
        </div>
        <ParentListSkeleton />
      </div>
      <div className={`flex-1 min-w-0 ${withDetail ? "block" : "hidden lg:block"}`}>
        <ParentDetailSkeleton />
      </div>
    </>
  );
}

function ParentsView() {
  const router = useRouter();
  const selectedId = useSearchParams().get("id");
  const { parents, loading, error, reload } = useParents();

  const select = (id: string | null) => router.replace(id ? `/parents?id=${id}` : "/parents", { scroll: false });

  const actions = useParentActions({
    onAdded: (p) => select(p.id),
    onDeleted: (id) => id === selectedId && select(null),
  });

  // Without a selection, desktop shows whoever needs attention most.
  const fallback = useMemo(() => {
    const now = new Date();
    return [...parents].sort((a, b) => getParentStatus(a, now).rank - getParentStatus(b, now).rank)[0] || null;
  }, [parents]);
  const selected = parents.find((p) => p.id === selectedId) || null;
  const shown = selected || fallback;

  if (loading) return <LoadingView withDetail={Boolean(selectedId)} />;

  if (error) {
    return (
      <div className="px-5 sm:px-10">
        <EmptyState title="Couldn't load parents." action={<Button size="sm" onClick={() => reload()}>Try again</Button>}>
          {error}
        </EmptyState>
      </div>
    );
  }

  return (
    <>
      <ParentsListColumn
        className={selected ? "hidden lg:flex" : "flex"}
        parents={parents}
        selectedParentId={shown?.id || null}
        onSelectParent={(p) => select(p.id)}
        onAddParentClick={actions.openAdd}
        onInviteClick={actions.openInvite}
      />
      <div className={`flex-1 min-w-0 ${selected ? "flex" : "hidden lg:flex"}`}>
        <ParentDetailCanvas
          parent={shown}
          onCallNow={actions.openCall}
          onEditClick={actions.openEdit}
          isCalling={actions.isCalling}
          backHref="/parents"
        />
      </div>
      {actions.ui}
    </>
  );
}

export default function ParentsPage() {
  return (
    <Suspense fallback={<LoadingView withDetail={false} />}>
      <ParentsView />
    </Suspense>
  );
}
