'use client';

import { useState, useMemo } from 'react';
import { useAppointments, type Appointment } from '@/hooks/use-appointments';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

type CalendarDay = {
  date: Date;
  isCurrentMonth: boolean;
  appointments: Appointment[];
};

export default function AppointmentCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Calculate date range for API query (current month + padding)
  const startOfMonth = new Date(year, month, 1);
  const endOfMonth = new Date(year, month + 1, 0);
  const startDate = new Date(startOfMonth);
  startDate.setDate(startDate.getDate() - 7);
  const endDate = new Date(endOfMonth);
  endDate.setDate(endDate.getDate() + 7);

  const { data, isLoading } = useAppointments({
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
  });

  const appointments = data?.data || [];

  const calendarDays = useMemo(() => {
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);
    const firstDayWeekday = firstDayOfMonth.getDay();
    const daysInMonth = lastDayOfMonth.getDate();

    const days: CalendarDay[] = [];

    // Previous month padding
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = firstDayWeekday - 1; i >= 0; i--) {
      const date = new Date(year, month - 1, prevMonthLastDay - i);
      days.push({
        date,
        isCurrentMonth: false,
        appointments: appointments.filter(apt => {
          const aptDate = new Date(apt.scheduled_datetime);
          return aptDate.toDateString() === date.toDateString();
        }),
      });
    }

    // Current month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      days.push({
        date,
        isCurrentMonth: true,
        appointments: appointments.filter(apt => {
          const aptDate = new Date(apt.scheduled_datetime);
          return aptDate.toDateString() === date.toDateString();
        }),
      });
    }

    // Next month padding
    const remainingDays = 42 - days.length; // 6 weeks * 7 days
    for (let day = 1; day <= remainingDays; day++) {
      const date = new Date(year, month + 1, day);
      days.push({
        date,
        isCurrentMonth: false,
        appointments: appointments.filter(apt => {
          const aptDate = new Date(apt.scheduled_datetime);
          return aptDate.toDateString() === date.toDateString();
        }),
      });
    }

    return days;
  }, [year, month, appointments]);

  const goToPreviousMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
    setSelectedDay(null);
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
    setSelectedDay(null);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
    setSelectedDay(null);
  };

  const selectedDayAppointments = selectedDay
    ? appointments.filter(apt => {
        const aptDate = new Date(apt.scheduled_datetime);
        return aptDate.toDateString() === selectedDay.toDateString();
      })
    : [];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-center gap-3">
        <button
          onClick={goToPreviousMonth}
          className="rounded-full border border-[#d7b73f]/30 bg-[#d7b73f]/10 px-3 py-1 text-sm font-semibold hover:bg-[#d7b73f]/15"
          style={{ color: '#d7b73f' }}
        >
          ←
        </button>
        <div className="min-w-[200px] text-center text-xl font-semibold text-slate-200">
          {MONTHS[month]} {year}
        </div>
        <button
          onClick={goToNextMonth}
          className="rounded-full border border-[#d7b73f]/30 bg-[#d7b73f]/10 px-3 py-1 text-sm font-semibold hover:bg-[#d7b73f]/15"
          style={{ color: '#d7b73f' }}
        >
          →
        </button>
      </div>

      <div className="flex justify-center">
        <button
          onClick={goToToday}
          className="rounded-full border border-[#d7b73f]/30 bg-[#d7b73f]/10 px-4 py-1 text-xs font-semibold hover:bg-[#d7b73f]/15"
          style={{ color: '#d7b73f' }}
        >
          {new Date().getDate()}
        </button>
      </div>

      {isLoading ? (
        <div className="surface p-8 text-center text-sm text-slate-300">Loading appointments...</div>
      ) : (
        <div className="surface overflow-hidden">
          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-white/10 bg-white/3">
            {DAYS.map(day => (
              <div key={day} className="px-2 py-3 text-center text-xs font-medium text-slate-400">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7">
            {calendarDays.map((day, idx) => {
              const isToday = day.date.toDateString() === new Date().toDateString();
              const isSelected = selectedDay?.toDateString() === day.date.toDateString();

              return (
                <button
                  key={idx}
                  onClick={() => setSelectedDay(day.date)}
                  className={`
                    min-h-[80px] border-b border-r border-white/5 p-2 text-left transition hover:bg-white/5
                    ${!day.isCurrentMonth ? 'bg-black/20 opacity-40' : ''}
                    ${isSelected ? 'bg-[#d7b73f]/10 ring-1 ring-inset ring-[#d7b73f]/30' : ''}
                  `}
                >
                  <div className="flex items-start justify-between">
                    <span
                      className={`
                        text-sm font-medium
                        ${isToday ? 'flex h-6 w-6 items-center justify-center rounded-full bg-[#d7b73f] text-black' : ''}
                        ${!isToday && day.isCurrentMonth ? 'text-slate-200' : ''}
                        ${!isToday && !day.isCurrentMonth ? 'text-slate-500' : ''}
                      `}
                    >
                      {day.date.getDate()}
                    </span>
                    {day.appointments.length > 0 && (
                      <span className="rounded-full bg-green-500/20 px-1.5 py-0.5 text-xs font-medium text-green-200">
                        {day.appointments.length}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 space-y-1">
                    {day.appointments.slice(0, 2).map(apt => (
                      <a
                        key={apt.id}
                        href={`/repair-orders/${apt.repair_order_id}`}
                        className={`block truncate rounded px-1.5 py-0.5 text-xs ${
                          apt.appointment_type === 'scheduled_drop_off'
                            ? 'bg-blue-500/15 hover:bg-blue-500/25'
                            : 'bg-green-500/15 hover:bg-green-500/25'
                        }`}
                        title={`${apt.customer_name || 'Customer'} - ${apt.service_type || 'Service'}\n${apt.appointment_type === 'scheduled_drop_off' ? 'Drop-off' : 'Estimated Complete'}\n${new Date(apt.scheduled_datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className={`font-medium ${apt.appointment_type === 'scheduled_drop_off' ? 'text-blue-200' : 'text-green-200'}`}>
                          {apt.customer_name || 'Unknown'}
                        </div>
                        <div className={`text-[10px] opacity-80 ${apt.appointment_type === 'scheduled_drop_off' ? 'text-blue-300' : 'text-green-300'}`}>
                          {apt.appointment_type === 'scheduled_drop_off' ? 'Drop-off' : 'Est. Complete'}
                        </div>
                      </a>
                    ))}
                    {day.appointments.length > 2 && (
                      <div className="text-xs text-slate-400">+{day.appointments.length - 2} more</div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Selected day appointments */}
      {selectedDay && (
        <div className="surface p-4">
          <h3 className="mb-3 text-lg font-semibold text-slate-200">
            {selectedDay.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </h3>
          {selectedDayAppointments.length === 0 ? (
            <p className="text-sm text-slate-400">No appointments scheduled</p>
          ) : (
            <div className="space-y-2">
              {selectedDayAppointments.map(apt => (
                <a
                  key={apt.id}
                  href={`/repair-orders/${apt.repair_order_id}`}
                  className="block rounded-lg border border-white/10 bg-white/3 p-3 hover:bg-white/5 transition"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className={`font-semibold ${apt.appointment_type === 'scheduled_drop_off' ? 'text-blue-200' : 'text-green-200'}`}>
                        {apt.customer_name || 'Unknown Customer'}
                      </div>
                      <div className={`mt-1 text-sm ${apt.appointment_type === 'scheduled_drop_off' ? 'text-blue-300' : 'text-green-300'}`}>
                        {apt.service_type || 'Service'} - {apt.appointment_type === 'scheduled_drop_off' ? 'Scheduled Drop-off' : 'Estimated Complete'}
                      </div>
                      {apt.vehicle_display && (
                        <div className="mt-1 text-sm text-slate-400">{apt.vehicle_display}</div>
                      )}
                      <div className="mt-2 text-xs text-slate-500">
                        {new Date(apt.scheduled_datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                    <span
                      className={`
                        rounded-full px-2 py-1 text-xs font-medium
                        ${apt.status === 'scheduled' ? 'bg-blue-500/15 text-blue-200' : ''}
                        ${apt.status === 'in_progress' ? 'bg-yellow-500/15 text-yellow-200' : ''}
                        ${apt.status === 'completed' ? 'bg-green-500/15 text-green-200' : ''}
                        ${apt.status === 'cancelled' ? 'bg-red-500/15 text-red-200' : ''}
                      `}
                    >
                      {apt.zoho_status || apt.status}
                    </span>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
