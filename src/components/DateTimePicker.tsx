'use client';

import { useState, useEffect, useRef } from 'react';

interface DateTimePickerProps {
  value: string; // ISO string or datetime-local format
  onChange: (value: string) => void;
  label: string;
  disabled?: boolean;
}

export function DateTimePicker({ value, onChange, label, disabled }: DateTimePickerProps) {
  const [date, setDate] = useState('');
  const [time, setTime] = useState('12:00');
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (value) {
      const d = new Date(value);
      if (!isNaN(d.getTime())) {
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const hh = String(d.getHours()).padStart(2, '0');
        const mi = String(d.getMinutes()).padStart(2, '0');
        setDate(`${yyyy}-${mm}-${dd}`);
        setTime(`${hh}:${mi}`);
      }
    }
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleDateChange = (newDate: string) => {
    setDate(newDate);
    if (newDate && time) {
      const combined = `${newDate}T${time}`;
      onChange(combined);
    }
  };

  const handleTimeChange = (newTime: string) => {
    setTime(newTime);
    if (date && newTime) {
      const combined = `${date}T${newTime}`;
      onChange(combined);
    }
  };

  const handleQuickTime = (hour: number) => {
    const newTime = `${String(hour).padStart(2, '0')}:00`;
    setTime(newTime);
    if (date) {
      const combined = `${date}T${newTime}`;
      onChange(combined);
    }
  };

  const handleToday = () => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const newDate = `${yyyy}-${mm}-${dd}`;
    setDate(newDate);
    if (time) {
      onChange(`${newDate}T${time}`);
    }
  };

  const handleTomorrow = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const yyyy = tomorrow.getFullYear();
    const mm = String(tomorrow.getMonth() + 1).padStart(2, '0');
    const dd = String(tomorrow.getDate()).padStart(2, '0');
    const newDate = `${yyyy}-${mm}-${dd}`;
    setDate(newDate);
    if (time) {
      onChange(`${newDate}T${time}`);
    }
  };

  const handleClear = () => {
    setDate('');
    setTime('12:00');
    onChange('');
  };

  const formattedDateTime = date && time 
    ? new Date(`${date}T${time}`).toLocaleString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : 'Not set';

  return (
    <div ref={containerRef} className="relative">
      <div className="text-xs font-medium mb-1 text-slate-300">
        {label}
      </div>

      {/* Collapsed View - Click to expand */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`w-full text-left rounded-full border border-[#D4AF37]/25 bg-[#D4AF37]/8 px-4 py-2 backdrop-blur transition-all ${
          isOpen ? 'ring-2 ring-[#d7b73f]/30' : ''
        } ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:border-[#D4AF37]/40'}`}
      >
        <div className="flex items-center justify-between">
          <span className={date && time ? 'text-slate-100' : 'text-slate-400'}>
            {formattedDateTime}
          </span>
          <svg 
            className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Expanded View - Date/Time picker with quick buttons */}
      {isOpen && !disabled && (
        <div className="absolute z-50 mt-2 w-full rounded-lg border border-white/10 bg-[#1a1a1a] p-4 shadow-2xl space-y-3">
          {/* Date Selection */}
          <div className="space-y-2">
            <input
              type="date"
              value={date}
              onChange={(e) => handleDateChange(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-black/30 px-4 py-2.5 text-sm text-slate-100 outline-none focus:border-[#d7b73f]/50 transition-colors"
            />
            
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleToday}
                className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/10 hover:border-[#d7b73f]/30 transition-all"
              >
                Today
              </button>
              <button
                type="button"
                onClick={handleTomorrow}
                className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/10 hover:border-[#d7b73f]/30 transition-all"
              >
                Tomorrow
              </button>
            </div>
          </div>

          {/* Time Selection */}
          <div className="space-y-2">
            <input
              type="time"
              value={time}
              onChange={(e) => handleTimeChange(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-black/30 px-4 py-2.5 text-sm text-slate-100 outline-none focus:border-[#d7b73f]/50 transition-colors"
            />
            
            <div className="grid grid-cols-3 gap-2">
              {[8, 10, 12, 14, 16, 18].map((hour) => (
                <button
                  key={hour}
                  type="button"
                  onClick={() => handleQuickTime(hour)}
                  className={`rounded-lg border px-2 py-1.5 text-xs transition-all ${
                    time === `${String(hour).padStart(2, '0')}:00`
                      ? 'border-[#d7b73f] bg-[#d7b73f]/20 text-[#d7b73f]'
                      : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:border-[#d7b73f]/30'
                  }`}
                >
                  {hour > 12 ? `${hour - 12}PM` : `${hour}${hour === 12 ? 'PM' : 'AM'}`}
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2 border-t border-white/10">
            <button
              type="button"
              onClick={handleClear}
              className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300 hover:bg-white/10 hover:border-red-500/30 hover:text-red-400 transition-all"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="flex-1 rounded-lg border border-[#d7b73f]/30 bg-[#d7b73f]/10 px-3 py-2 text-xs text-[#d7b73f] hover:bg-[#d7b73f]/20 transition-all"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
