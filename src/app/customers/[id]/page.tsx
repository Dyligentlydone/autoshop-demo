import { Suspense } from 'react';
import CustomerDetailClient from './customer-detail-client';

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <Suspense>
      <CustomerDetailClient id={id} />
    </Suspense>
  );
}
