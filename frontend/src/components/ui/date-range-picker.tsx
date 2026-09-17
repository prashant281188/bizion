'use client';

import React, { useState, useEffect } from 'react';
import { Select } from '@/components/ui/select';
import { Calendar, X, ArrowRight } from 'lucide-react';

interface DateRangePickerProps {
  startDate: string;
  endDate: string;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  onClear?: () => void;
  className?: string;
}

export function DateRangePicker({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  onClear,
  className = '',
}: DateRangePickerProps) {
  const [explicitCustom, setExplicitCustom] = useState(false);

  const formatYMD = (y: number, m: number, day: number) => {
    const temp = new Date(y, m, day);
    return `${temp.getFullYear()}-${String(temp.getMonth() + 1).padStart(2, '0')}-${String(temp.getDate()).padStart(2, '0')}`;
  };

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const fyStartYear = currentMonth >= 3 ? currentYear : currentYear - 1;

  const currentFyStart = formatYMD(fyStartYear, 3, 1);
  const currentFyEnd = formatYMD(fyStartYear + 1, 2, 31);

  const prevFyStart = formatYMD(fyStartYear - 1, 3, 1);
  const prevFyEnd = formatYMD(fyStartYear, 2, 31);

  const currentMonthStart = formatYMD(now.getFullYear(), now.getMonth(), 1);
  const currentMonthEnd = formatYMD(now.getFullYear(), now.getMonth() + 1, 0);

  const prevMonthStart = formatYMD(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonthEnd = formatYMD(now.getFullYear(), now.getMonth(), 0);

  // Initialize with Current FY if empty
  useEffect(() => {
    if (!startDate && !endDate && !explicitCustom) {
      onStartDateChange(currentFyStart);
      onEndDateChange(currentFyEnd);
    }
  }, []);

  // Determine active preset value dynamically
  const activePreset = (() => {
    if (explicitCustom) return 'custom';
    if (!startDate && !endDate) return 'all';
    if (startDate === currentFyStart && endDate === currentFyEnd) return 'currentFy';
    if (startDate === currentMonthStart && endDate === currentMonthEnd) return 'currentMonth';
    if (startDate === prevMonthStart && endDate === prevMonthEnd) return 'previousMonth';
    if (startDate === prevFyStart && endDate === prevFyEnd) return 'previousFy';
    return 'custom';
  })();

  const handleDateFilterChange = (e: any) => {
    const val = typeof e === 'string' ? e : e?.target?.value;
    if (!val) return;

    if (val === 'custom') {
      setExplicitCustom(true);
      return;
    }

    setExplicitCustom(false);
    const d = new Date();

    switch (val) {
      case 'all': {
        onStartDateChange('');
        onEndDateChange('');
        break;
      }
      case 'currentMonth': {
        onStartDateChange(formatYMD(d.getFullYear(), d.getMonth(), 1));
        onEndDateChange(formatYMD(d.getFullYear(), d.getMonth() + 1, 0));
        break;
      }
      case 'previousMonth': {
        onStartDateChange(formatYMD(d.getFullYear(), d.getMonth() - 1, 1));
        onEndDateChange(formatYMD(d.getFullYear(), d.getMonth(), 0));
        break;
      }
      case 'currentFy': {
        const year = d.getMonth() < 3 ? d.getFullYear() - 1 : d.getFullYear();
        onStartDateChange(formatYMD(year, 3, 1)); // April 1st
        onEndDateChange(formatYMD(year + 1, 2, 31)); // March 31st
        break;
      }
      case 'previousFy': {
        const year = d.getMonth() < 3 ? d.getFullYear() - 2 : d.getFullYear() - 1;
        onStartDateChange(formatYMD(year, 3, 1));
        onEndDateChange(formatYMD(year + 1, 2, 31));
        break;
      }
    }
  };

  const currentMonthName = now.toLocaleString('en-US', { month: 'short' }) + ' ' + now.getFullYear();
  const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonthName = prevMonthDate.toLocaleString('en-US', { month: 'short' }) + ' ' + prevMonthDate.getFullYear();
  const currentFyLabel = `FY ${fyStartYear}-${String(fyStartYear + 1).slice(2)}`;
  const prevFyLabel = `FY ${fyStartYear - 1}-${String(fyStartYear).slice(2)}`;

  const DATE_PRESET_OPTIONS = [
    { value: 'currentFy', label: `Current (${currentFyLabel})` },
    { value: 'all', label: 'All Dates' },
    { value: 'currentMonth', label: `Current Month (${currentMonthName})` },
    { value: 'previousMonth', label: `Previous Month (${prevMonthName})` },
    { value: 'previousFy', label: `Previous (${prevFyLabel})` },
    { value: 'custom', label: 'Custom Date Range...' },
  ];

  return (
    <div className={`flex items-center gap-2 shrink-0 ${className}`}>
      {/* Preset Selector */}
      <div className="relative shrink-0">
        <Select
          value={activePreset}
          onChange={handleDateFilterChange}
          options={DATE_PRESET_OPTIONS}
          className="h-[36px] w-[190px] shrink-0 text-xs bg-zinc-50 border-zinc-200 rounded-xl font-medium pl-2.5"
        />
      </div>

      {/* Custom From / To Date Inputs */}
      {activePreset === 'custom' && (
        <div className="flex items-center space-x-1.5 rounded-xl border border-zinc-200 bg-zinc-50 px-3 h-[36px] shrink-0 shadow-sm">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold text-zinc-500 uppercase shrink-0">From</span>
            <input
              type="date"
              value={startDate || ''}
              onChange={(e) => {
                setExplicitCustom(true);
                onStartDateChange(e.target.value);
              }}
              className="bg-transparent text-xs font-semibold text-zinc-800 focus:outline-none cursor-pointer"
            />
          </div>
          <span className="text-zinc-300">|</span>
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold text-zinc-500 uppercase shrink-0">To</span>
            <input
              type="date"
              value={endDate || ''}
              onChange={(e) => {
                setExplicitCustom(true);
                onEndDateChange(e.target.value);
              }}
              className="bg-transparent text-xs font-semibold text-zinc-800 focus:outline-none cursor-pointer"
            />
          </div>
        </div>
      )}

      {/* Reset / Clear Button */}
      {(startDate || endDate) && (
        <button
          type="button"
          onClick={() => {
            setExplicitCustom(false);
            onStartDateChange('');
            onEndDateChange('');
            if (onClear) onClear();
          }}
          className="h-[36px] px-2.5 text-xs font-semibold text-amber-800 hover:text-amber-900 bg-amber-50 hover:bg-amber-100/80 border border-amber-200/80 rounded-xl transition-all shrink-0 flex items-center gap-1"
          title="Clear date filter"
        >
          <X className="w-3.5 h-3.5 text-amber-700" />
          Clear
        </button>
      )}
    </div>
  );
}
