'use client';

import { use } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import EstimateCalculator from '@/components/estimate-calculator';

export default function RepairOrderEstimatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  return (
    <div className="min-h-screen bg-black p-6">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-6 flex items-center gap-4">
          <Link
            href="/repair-orders"
            className="flex items-center gap-2 text-slate-400 hover:text-[#d7b73f]"
          >
            <ArrowLeft size={20} />
            Back to Repair Orders
          </Link>
        </div>

        {/* Estimate Calculator */}
        <EstimateCalculator repairOrderId={id} />
      </div>
    </div>
  );
}
