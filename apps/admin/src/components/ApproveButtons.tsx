import { setProjectStatus } from "@/app/actions";

export function ApproveButtons({ id }: { id: string }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
      <form action={setProjectStatus} className="min-w-0">
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="status" value="APPROVED" />
        <button type="submit" className="min-h-11 w-full rounded-lg bg-ink-700 px-3 py-1.5 text-xs font-semibold text-cream-50 sm:w-auto">
          Approve
        </button>
      </form>
      <form action={setProjectStatus} className="min-w-0">
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="status" value="REJECTED" />
        <input type="hidden" name="reason" value="Does not meet exhibition guidelines" />
        <button type="submit" className="min-h-11 w-full rounded-lg border border-red-400/40 px-3 py-1.5 text-xs text-red-200 sm:w-auto">
          Reject
        </button>
      </form>
    </div>
  );
}
