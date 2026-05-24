import { Suspense } from 'react';
import VehicleDetailClient from './vehicle-detail-client';

export default async function VehicleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <Suspense>
      <VehicleDetailClient id={id} />
    </Suspense>
  );
}
