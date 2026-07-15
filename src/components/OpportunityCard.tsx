import Link from "next/link";
import type { OpportunityCard as Card } from "@/db/queries";
import { costCompText, eligibilityText } from "@/lib/display";
import { categoryLabel, formatLabel } from "@/lib/taxonomy";
import { Chip, DeadlineBadge, VerificationBadge } from "@/components/Badges";
import { SaveButton } from "@/components/SaveCompare";

export function OpportunityCardView({ card, matchReason }: { card: Card; matchReason?: string }) {
  return (
    <div className="group relative flex h-full flex-col gap-2 rounded-xl border border-stone-200 bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-teal-300 hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <div>
          <Link href={`/opportunities/${card.slug}`} className="font-semibold text-stone-900 group-hover:text-teal-800">
            {card.title}
          </Link>
          <p className="text-sm text-stone-500">{card.orgName}</p>
        </div>
        <SaveButton id={card.id} />
      </div>

      <div className="flex flex-wrap gap-1.5">
        <Chip>{categoryLabel(card.category)}</Chip>
        <Chip>{card.city}</Chip>
        <Chip>{formatLabel(card.format)}</Chip>
        <Chip>{eligibilityText(card)}</Chip>
        <Chip>{costCompText(card)}</Chip>
      </div>

      {matchReason && <p className="text-sm text-teal-800 bg-teal-50 rounded-md px-2 py-1">{matchReason}</p>}

      <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
        <DeadlineBadge deadline={card.applicationDeadline} />
        <VerificationBadge lastVerifiedAt={card.lastVerifiedAt} />
        {card.timeCommitment && <span className="text-xs text-stone-500">{card.timeCommitment}</span>}
      </div>
    </div>
  );
}
