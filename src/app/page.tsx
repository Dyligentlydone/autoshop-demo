import GlobalSearch from '@/components/global-search';
import AppointmentCalendar from '@/components/appointment-calendar';
import ServiceStats from '@/components/service-stats';

export default function HomePage() {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col gap-4">
      <div className="relative z-50">
        <GlobalSearch placeholder="Search customers, vehicles, repair orders…" className="w-full" />
      </div>

      <p className="text-center text-base" style={{ color: '#d7b73f' }}>
        Create and manage repair orders.
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <a
          className="group relative z-0 flex w-full items-center justify-center rounded-full border border-[#D4AF37]/35 bg-[#D4AF37]/12 px-6 py-3 text-center backdrop-blur transition hover:bg-[#D4AF37]/18 active:bg-[#D4AF37]/22"
          href="/estimate"
        >
          <div className="text-lg font-semibold" style={{ color: '#d7b73f' }}>
            Estimate
          </div>
        </a>

        <a
          className="group relative z-0 flex w-full items-center justify-center rounded-full border border-[#D4AF37]/35 bg-[#D4AF37]/12 px-6 py-3 text-center backdrop-blur transition hover:bg-[#D4AF37]/18 active:bg-[#D4AF37]/22"
          href="/repair-orders/new"
        >
          <div className="text-lg font-semibold" style={{ color: '#d7b73f' }}>
            New Repair Order
          </div>
        </a>

        <a
          className="group relative z-0 flex w-full items-center justify-center rounded-full border border-[#D4AF37]/35 bg-[#D4AF37]/12 px-6 py-3 text-center backdrop-blur transition hover:bg-[#D4AF37]/18 active:bg-[#D4AF37]/22"
          href="/repair-orders"
        >
          <div className="text-lg font-semibold" style={{ color: '#d7b73f' }}>
            All Repair Orders
          </div>
        </a>
      </div>

      {/* Appointment Calendar */}
      <div className="mt-8">
        <AppointmentCalendar />
      </div>

      {/* Service Statistics */}
      <ServiceStats />

      <div className="mt-auto pb-6 text-center text-4xl font-semibold text-slate-800">
        "Lets Keep Having Fun"
      </div>
    </div>
  );
}
