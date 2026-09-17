'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { Contact } from '@/types';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formatCurrency } from '@/lib/utils';
import {
  Calendar,
  MapPin,
  Building2,
  Phone,
  CheckCircle2,
  AlertTriangle,
  Printer,
  Search,
  Plus,
  Compass,
  Layers,
  ChevronRight,
  Trash2,
  Edit2,
  Navigation,
  Clock,
  UserCheck,
  CheckSquare,
} from 'lucide-react';
import { toast } from 'sonner';

const DAYS_OF_WEEK = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

interface DateVisitAssignment {
  id: string;
  date: string; // YYYY-MM-DD
  contactId: string;
  notes?: string;
  status?: 'scheduled' | 'completed' | 'rescheduled' | 'follow_up' | 'order_taken';
  outcomeNotes?: string;
  amountCollected?: number;
  completedAt?: string;
}

interface TourPlan {
  id: string;
  name: string;
  month: string;
  year: number;
  cities: string[];
  plannedVisitIds: string[];
  dateVisits?: DateVisitAssignment[];
  notes?: string;
  createdAt: string;
}

export default function MultiTourVisitPlannerPage() {
  const currentYear = new Date().getFullYear();
  const currentMonthName = MONTHS[new Date().getMonth()];

  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthName);
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);

  // Saved Tours State (Persisted in localStorage)
  const [tours, setTours] = useState<TourPlan[]>([]);
  const [activeTourId, setActiveTourId] = useState<string | null>(null);

  // Tour Builder Modal State
  const [isTourModalOpen, setIsTourModalOpen] = useState(false);
  const [isReuseModalOpen, setIsReuseModalOpen] = useState(false);
  const [editingTourId, setEditingTourId] = useState<string | null>(null);
  const [tourNameInput, setTourNameInput] = useState('');
  const [tourCitiesInput, setTourCitiesInput] = useState<string[]>([]);
  const [tourNotesInput, setTourNotesInput] = useState('');

  // Target Date Picker State for Date-Wise Tour Planning
  const [targetVisitDate, setTargetVisitDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [searchQuery, setSearchQuery] = useState('');
  const [hideClosedClients, setHideClosedClients] = useState(true);

  // Party Date Assignment Modal State
  const [selectedPartyForDateModal, setSelectedPartyForDateModal] = useState<Contact | null>(null);
  const [modalVisitDate, setModalVisitDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [modalVisitNotes, setModalVisitNotes] = useState<string>('');

  // Check-In & Visit Outcome Modal State
  const [checkInVisit, setCheckInVisit] = useState<{ assignment: DateVisitAssignment; contact: Contact } | null>(null);
  const [outcomeStatus, setOutcomeStatus] = useState<'completed' | 'order_taken' | 'follow_up' | 'rescheduled'>('completed');
  const [outcomeNotes, setOutcomeNotes] = useState('');
  const [amountCollectedInput, setAmountCollectedInput] = useState('');

  // Helper to get Day of Week name from YYYY-MM-DD
  const getDayNameFromDate = (dateStr: string): string => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return '';
    const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[d.getDay()];
  };

  // Fetch tour plans from PostgreSQL DB
  const { data: dbTours, refetch: refetchTours } = useQuery({
    queryKey: ['tour-plans'],
    queryFn: async () => {
      const res = await api.get('/tour-plans');
      return (res.data?.data || []) as TourPlan[];
    },
  });

  useEffect(() => {
    if (dbTours && dbTours.length > 0) {
      setTours(dbTours);
      if (!activeTourId) setActiveTourId(dbTours[0].id);
    } else {
      try {
        const saved = localStorage.getItem('bizion_monthly_tours');
        if (saved) {
          const parsed = JSON.parse(saved);
          setTours(parsed);
          if (parsed.length > 0 && !activeTourId) setActiveTourId(parsed[0].id);
        }
      } catch (e) {}
    }
  }, [dbTours]);

  // Save tours to localStorage and sync with PostgreSQL DB
  const saveToursToStorage = async (updatedTours: TourPlan[], tourToSync?: TourPlan) => {
    setTours(updatedTours);
    try {
      localStorage.setItem('bizion_monthly_tours', JSON.stringify(updatedTours));
    } catch (e) {}

    try {
      if (tourToSync) {
        await api.put(`/tour-plans/${tourToSync.id}`, tourToSync).catch(async () => {
          await api.post('/tour-plans', tourToSync);
        });
      } else {
        for (const t of updatedTours) {
          await api.put(`/tour-plans/${t.id}`, t).catch(async () => {
            await api.post('/tour-plans', t);
          });
        }
      }
      refetchTours();
    } catch (e) {
      console.error('Failed to sync tour to DB', e);
    }
  };

  // Fetch all customer contacts
  const { data: contactsData, isLoading } = useQuery({
    queryKey: ['multi-tour-contacts'],
    queryFn: async () => {
      const res = await api.get('/contacts?limit=1000');
      return (res.data?.data || []) as Contact[];
    },
  });

  const contacts = useMemo(() => {
    return (contactsData || []).filter(c => c.type !== 'vendor');
  }, [contactsData]);

  // Extract unique cities from all customer addresses
  const allCitiesList = useMemo(() => {
    const set = new Set<string>();
    contacts.forEach((c) => {
      if (c.addresses && c.addresses.length > 0) {
        c.addresses.forEach((a) => {
          if (a.city?.trim()) {
            set.add(a.city.trim());
          }
        });
      }
    });
    return Array.from(set).sort();
  }, [contacts]);

  // Filter tours for selected Month & Year
  const monthlyTours = useMemo(() => {
    return tours.filter((t) => t.month === selectedMonth && t.year === selectedYear);
  }, [tours, selectedMonth, selectedYear]);

  // Active Selected Tour Object
  const activeTour = useMemo(() => {
    return tours.find((t) => t.id === activeTourId) || monthlyTours[0] || null;
  }, [tours, activeTourId, monthlyTours]);

  // Unique Master Tour Templates across all saved tours
  const masterTourTemplates = useMemo(() => {
    const map = new Map<string, { name: string; cities: string[]; notes?: string }>();
    tours.forEach((t) => {
      const key = `${t.name.trim().toLowerCase()}_${[...t.cities].sort().join('_').toLowerCase()}`;
      if (!map.has(key)) {
        map.set(key, { name: t.name, cities: t.cities, notes: t.notes });
      }
    });
    return Array.from(map.values());
  }, [tours]);

  // Activate / Reuse a Master Tour for selected Month & Year
  const handleReuseMasterTour = (template: { name: string; cities: string[]; notes?: string }) => {
    const exists = monthlyTours.some((t) => t.name.toLowerCase() === template.name.toLowerCase());
    if (exists) {
      toast.info(`"${template.name}" is already active for ${selectedMonth} ${selectedYear}`);
      setIsReuseModalOpen(false);
      return;
    }

    const monthIndex = MONTHS.indexOf(selectedMonth);
    const targetYear = selectedYear;
    const daysInMonth = monthIndex !== -1 ? new Date(targetYear, monthIndex + 1, 0).getDate() : 30;

    // Eligible contacts
    const eligibleContacts = contacts.filter((c) =>
      c.type !== 'vendor' &&
      c.addresses?.some((a) =>
        template.cities.some((tc) => tc.toLowerCase() === a.city?.toLowerCase())
      )
    );

    const autoDateVisits: DateVisitAssignment[] = [];
    const autoPlannedIds = new Set<string>();

    if (monthIndex !== -1) {
      eligibleContacts.forEach((contact) => {
        let startDay = 1;
        let endDay = daysInMonth;

        const prefWeek = (contact.preferredVisitWeek || '').toLowerCase();
        if (prefWeek.includes('1st')) { startDay = 1; endDay = Math.min(7, daysInMonth); }
        else if (prefWeek.includes('2nd')) { startDay = 8; endDay = Math.min(14, daysInMonth); }
        else if (prefWeek.includes('3rd')) { startDay = 15; endDay = Math.min(21, daysInMonth); }
        else if (prefWeek.includes('4th')) { startDay = 22; endDay = daysInMonth; }

        let assignedDateStr: string | null = null;
        for (let day = startDay; day <= endDay; day++) {
          const dateObj = new Date(targetYear, monthIndex, day);
          const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dateObj.getDay()];
          const isClosedOnDay = contact.weeklyOff?.toLowerCase() === dayName.toLowerCase();

          if (!isClosedOnDay) {
            const mStr = String(monthIndex + 1).padStart(2, '0');
            const dStr = String(day).padStart(2, '0');
            assignedDateStr = `${targetYear}-${mStr}-${dStr}`;
            break;
          }
        }

        if (!assignedDateStr) {
          for (let day = 1; day <= daysInMonth; day++) {
            const dateObj = new Date(targetYear, monthIndex, day);
            const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dateObj.getDay()];
            const isClosedOnDay = contact.weeklyOff?.toLowerCase() === dayName.toLowerCase();

            if (!isClosedOnDay) {
              const mStr = String(monthIndex + 1).padStart(2, '0');
              const dStr = String(day).padStart(2, '0');
              assignedDateStr = `${targetYear}-${mStr}-${dStr}`;
              break;
            }
          }
        }

        if (assignedDateStr) {
          autoDateVisits.push({
            id: `dv_reuse_${contact.id}_${Date.now()}`,
            date: assignedDateStr,
            contactId: contact.id,
            notes: `Reused Master Tour (${contact.visitFrequency || 'monthly'})`,
          });
          autoPlannedIds.add(contact.id);
        }
      });
    }

    const newTour: TourPlan = {
      id: `tour_reuse_${Date.now()}`,
      name: template.name,
      month: selectedMonth,
      year: selectedYear,
      cities: template.cities,
      plannedVisitIds: Array.from(autoPlannedIds),
      dateVisits: autoDateVisits,
      notes: template.notes,
      createdAt: new Date().toISOString(),
    };

    const updated = [newTour, ...tours];
    saveToursToStorage(updated);
    setActiveTourId(newTour.id);
    setIsReuseModalOpen(false);
    toast.success(`🔁 Activated "${template.name}" for ${selectedMonth} ${selectedYear} with ${autoDateVisits.length} auto-scheduled visits!`);
  };

  // Open modal to create a new tour
  const handleOpenCreateTourModal = () => {
    setEditingTourId(null);
    setTourNameInput(`Tour ${monthlyTours.length + 1}: Multi-City Drive`);
    setTourCitiesInput([]);
    setTourNotesInput('');
    setIsTourModalOpen(true);
  };

  // Open modal to edit an existing tour
  const handleOpenEditTourModal = (tour: TourPlan) => {
    setEditingTourId(tour.id);
    setTourNameInput(tour.name);
    setTourCitiesInput(tour.cities);
    setTourNotesInput(tour.notes || '');
    setIsTourModalOpen(true);
  };

  // Save or update tour
  const handleSaveTour = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tourNameInput.trim()) {
      toast.error('Tour name is required.');
      return;
    }
    if (tourCitiesInput.length === 0) {
      toast.warning('Please select at least one city for this tour.');
      return;
    }

    if (editingTourId) {
      // Update
      const updated = tours.map((t) => {
        if (t.id === editingTourId) {
          return {
            ...t,
            name: tourNameInput.trim(),
            cities: tourCitiesInput,
            notes: tourNotesInput.trim() || undefined,
          };
        }
        return t;
      });
      saveToursToStorage(updated);
      toast.success('Tour plan updated successfully');
    } else {
      // Create
      const newTour: TourPlan = {
        id: `tour_${Date.now()}`,
        name: tourNameInput.trim(),
        month: selectedMonth,
        year: selectedYear,
        cities: tourCitiesInput,
        plannedVisitIds: [],
        notes: tourNotesInput.trim() || undefined,
        createdAt: new Date().toISOString(),
      };
      const updated = [...tours, newTour];
      saveToursToStorage(updated);
      setActiveTourId(newTour.id);
      toast.success('New monthly tour created successfully');
    }
    setIsTourModalOpen(false);
  };

  // Delete a tour
  const handleDeleteTour = async (tourId: string) => {
    const updated = tours.filter((t) => t.id !== tourId);
    saveToursToStorage(updated);
    if (activeTourId === tourId) {
      setActiveTourId(updated[0]?.id || null);
    }
    try {
      await api.delete(`/tour-plans/${tourId}`);
    } catch (e) {
      console.error('Failed to delete tour from DB', e);
    }
    toast.success('Tour deleted');
  };

  // Toggle city in tour builder
  const toggleCityInInput = (cityName: string) => {
    setTourCitiesInput((prev) =>
      prev.includes(cityName) ? prev.filter((c) => c !== cityName) : [...prev, cityName]
    );
  };

  // Open Date Assignment Modal for specific party
  const handleOpenPartyDateModal = (contact: Contact) => {
    setSelectedPartyForDateModal(contact);
    setModalVisitDate(targetVisitDate);
    setModalVisitNotes('');
  };

  // Assign client to specific visit date
  const assignClientToDate = (contact: Contact, dateStr: string, notes?: string) => {
    if (!activeTour) return;

    const dayName = getDayNameFromDate(dateStr);
    const isClosedOnDateDay = contact.weeklyOff?.toLowerCase() === dayName.toLowerCase();

    if (isClosedOnDateDay) {
      toast.error(`${contact.displayName} is closed on ${dayName}s (${contact.weeklyOff}) and cannot be scheduled for ${dateStr}.`);
      return;
    }

    const currentVisits = activeTour.dateVisits || [];
    const exists = currentVisits.some((v) => v.contactId === contact.id && v.date === dateStr);

    let updatedVisits: DateVisitAssignment[];
    if (exists) {
      // Remove
      updatedVisits = currentVisits.filter((v) => !(v.contactId === contact.id && v.date === dateStr));
      toast.info(`Removed ${contact.displayName} from ${dateStr}`);
    } else {
      // Add
      const newAssignment: DateVisitAssignment = {
        id: `dv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        date: dateStr,
        contactId: contact.id,
        notes: notes?.trim() || undefined,
      };
      updatedVisits = [...currentVisits, newAssignment];
      toast.success(`Scheduled ${contact.displayName} for ${dateStr} (${dayName})`);
    }

    // Also sync plannedVisitIds so legacy view shows all scheduled clients
    const allPlannedIds = Array.from(new Set([...activeTour.plannedVisitIds, contact.id]));

    const updatedTours = tours.map((t) => {
      if (t.id === activeTour.id) {
        return {
          ...t,
          plannedVisitIds: allPlannedIds,
          dateVisits: updatedVisits,
        };
      }
      return t;
    });

    saveToursToStorage(updatedTours);
  };

  // Remove specific date visit assignment by ID
  const removeDateVisit = (visitId: string) => {
    if (!activeTour) return;

    const currentVisits = activeTour.dateVisits || [];
    const updatedVisits = currentVisits.filter((v) => v.id !== visitId);

    const updatedTours = tours.map((t) => {
      if (t.id === activeTour.id) {
        return { ...t, dateVisits: updatedVisits };
      }
      return t;
    });

    saveToursToStorage(updatedTours);
    toast.success('Scheduled visit removed');
  };

  // Auto-Generate Smart Tour Plan for active tour considering weeklyOff, visitFrequency & preferredVisitWeek
  const autoScheduleTourVisits = () => {
    if (!activeTour) return;

    const monthIndex = MONTHS.indexOf(activeTour.month);
    const targetYear = activeTour.year;
    if (monthIndex === -1) return;

    const daysInMonth = new Date(targetYear, monthIndex + 1, 0).getDate();

    // All eligible contacts for this tour's cities
    const eligibleContacts = contacts.filter((c) =>
      c.type !== 'vendor' &&
      c.addresses?.some((a) =>
        activeTour.cities.some((tc) => tc.toLowerCase() === a.city?.toLowerCase())
      )
    );

    if (eligibleContacts.length === 0) {
      toast.error(`No eligible parties found in ${activeTour.cities.join(', ')}`);
      return;
    }

    const newDateVisits: DateVisitAssignment[] = [];
    const newPlannedIds = new Set<string>();

    eligibleContacts.forEach((contact) => {
      let startDay = 1;
      let endDay = daysInMonth;

      const prefWeek = (contact.preferredVisitWeek || '').toLowerCase();
      if (prefWeek.includes('1st')) { startDay = 1; endDay = Math.min(7, daysInMonth); }
      else if (prefWeek.includes('2nd')) { startDay = 8; endDay = Math.min(14, daysInMonth); }
      else if (prefWeek.includes('3rd')) { startDay = 15; endDay = Math.min(21, daysInMonth); }
      else if (prefWeek.includes('4th')) { startDay = 22; endDay = daysInMonth; }

      // Find first available day that does NOT fall on weeklyOff
      let assignedDateStr: string | null = null;
      for (let day = startDay; day <= endDay; day++) {
        const dateObj = new Date(targetYear, monthIndex, day);
        const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dateObj.getDay()];
        const isClosedOnDay = contact.weeklyOff?.toLowerCase() === dayName.toLowerCase();

        if (!isClosedOnDay) {
          const mStr = String(monthIndex + 1).padStart(2, '0');
          const dStr = String(day).padStart(2, '0');
          assignedDateStr = `${targetYear}-${mStr}-${dStr}`;
          break;
        }
      }

      // Fallback: scan entire month if preferred week has no open day
      if (!assignedDateStr) {
        for (let day = 1; day <= daysInMonth; day++) {
          const dateObj = new Date(targetYear, monthIndex, day);
          const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dateObj.getDay()];
          const isClosedOnDay = contact.weeklyOff?.toLowerCase() === dayName.toLowerCase();

          if (!isClosedOnDay) {
            const mStr = String(monthIndex + 1).padStart(2, '0');
            const dStr = String(day).padStart(2, '0');
            assignedDateStr = `${targetYear}-${mStr}-${dStr}`;
            break;
          }
        }
      }

      if (assignedDateStr) {
        newDateVisits.push({
          id: `dv_auto_${contact.id}_${Date.now()}`,
          date: assignedDateStr,
          contactId: contact.id,
          notes: `Auto-scheduled (${contact.visitFrequency || 'monthly'}, ${contact.preferredVisitWeek || 'any week'})`,
        });
        newPlannedIds.add(contact.id);
      }
    });

    const updatedTours = tours.map((t) => {
      if (t.id === activeTour.id) {
        return {
          ...t,
          plannedVisitIds: Array.from(newPlannedIds),
          dateVisits: newDateVisits,
        };
      }
      return t;
    });

    saveToursToStorage(updatedTours);
    toast.success(`⚡ Smart Auto-Scheduled ${newDateVisits.length} visits for ${activeTour.month} ${targetYear}!`);
  };

  // Eligible Clients for active tour & filters
  const tourClients = useMemo(() => {
    if (!activeTour) return [];

    return contacts.filter((c) => {
      // Must belong to one of the tour's selected cities
      const matchesCity = c.addresses?.some((a) =>
        activeTour.cities.some((tc) => tc.toLowerCase() === a.city?.toLowerCase())
      );
      if (!matchesCity) return false;

      // Hide closed clients on targetVisitDate
      const targetDayName = getDayNameFromDate(targetVisitDate);
      const isClosedOnDay = c.weeklyOff?.toLowerCase() === targetDayName.toLowerCase();
      if (hideClosedClients && isClosedOnDay) {
        return false;
      }

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = c.displayName?.toLowerCase().includes(q);
        const matchesCompany = c.companyName?.toLowerCase().includes(q);
        const matchesPhone = c.phone?.toLowerCase().includes(q) || c.mobile?.toLowerCase().includes(q);
        if (!matchesName && !matchesCompany && !matchesPhone) return false;
      }

      return true;
    });
  }, [contacts, activeTour, targetVisitDate, hideClosedClients, searchQuery]);

  // Group tourClients by City
  const tourClientsByCity = useMemo(() => {
    const map = new Map<string, Contact[]>();

    tourClients.forEach((contact) => {
      const city = contact.addresses?.[0]?.city?.trim() || 'Other Cities';
      if (!map.has(city)) {
        map.set(city, []);
      }
      map.get(city)!.push(contact);
    });

    return Array.from(map.entries()).map(([city, clients]) => ({
      city,
      clients,
    }));
  }, [tourClients]);

  // Selected Clients for active tour
  const selectedTourClients = useMemo(() => {
    if (!activeTour) return [];
    return contacts.filter((c) => activeTour.plannedVisitIds.includes(c.id));
  }, [contacts, activeTour]);

  // Group date-wise scheduled visits chronologically by date
  const dateGroupedSchedule = useMemo(() => {
    if (!activeTour || !activeTour.dateVisits) return [];

    const map = new Map<string, { date: string; dayName: string; visits: { assignment: DateVisitAssignment; contact: Contact }[] }>();

    activeTour.dateVisits.forEach((v) => {
      const contact = contacts.find((c) => c.id === v.contactId);
      if (!contact) return;

      if (!map.has(v.date)) {
        map.set(v.date, {
          date: v.date,
          dayName: getDayNameFromDate(v.date),
          visits: [],
        });
      }

      map.get(v.date)!.visits.push({ assignment: v, contact });
    });

    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [activeTour, contacts]);

  // Open Google Maps Multi-Stop Navigation Route for all clients on a date
  const openGoogleMapsRoute = (visits: { assignment: DateVisitAssignment; contact: Contact }[]) => {
    const locations = visits
      .map(({ contact }) => {
        const addr = contact.addresses?.[0];
        if (!addr) return contact.displayName;
        return `${contact.displayName}, ${addr.addressLine1 || ''} ${addr.city || ''}`.trim();
      })
      .filter(Boolean);

    if (locations.length === 0) {
      toast.error("No client addresses found for navigation");
      return;
    }

    if (locations.length === 1) {
      window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(locations[0])}`, '_blank');
      return;
    }

    const origin = encodeURIComponent(locations[0]);
    const destination = encodeURIComponent(locations[locations.length - 1]);
    const waypoints = locations
      .slice(1, -1)
      .map((loc) => encodeURIComponent(loc))
      .join('|');

    const mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}${
      waypoints ? `&waypoints=${waypoints}` : ''
    }&travelmode=driving`;

    window.open(mapsUrl, '_blank');
  };

  // Share Daily Itinerary on WhatsApp
  const shareItineraryViaWhatsApp = (group: { date: string; dayName: string; visits: { assignment: DateVisitAssignment; contact: Contact }[] }) => {
    let msg = `📍 *Visit Plan - ${group.date} (${group.dayName})*\n`;
    msg += `Tour: *${activeTour?.name || 'Field Tour'}*\n\n`;

    group.visits.forEach(({ assignment, contact }, idx) => {
      const addr = contact.addresses?.[0];
      const bal = Number((contact as any).balance ?? contact.openingBalance ?? 0);
      msg += `*${idx + 1}. ${contact.displayName}*\n`;
      if (contact.companyName) msg += `🏢 ${contact.companyName}\n`;
      if (addr) msg += `📍 ${addr.addressLine1 || ''}, ${addr.city || ''}\n`;
      if (contact.mobile || contact.phone) msg += `📞 ${contact.mobile || contact.phone}\n`;
      if (bal > 0) msg += `💰 Due: ${formatCurrency(bal)}\n`;
      if (assignment.status && assignment.status !== 'scheduled') {
        msg += `Status: [${assignment.status.toUpperCase()}]\n`;
      }
      msg += `\n`;
    });

    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(whatsappUrl, '_blank');
  };

  // Save Visit Check-In & Outcome
  const handleSaveCheckIn = () => {
    if (!checkInVisit || !activeTour) return;

    const updatedVisits = (activeTour.dateVisits || []).map((v) => {
      if (v.id === checkInVisit.assignment.id) {
        return {
          ...v,
          status: outcomeStatus,
          outcomeNotes: outcomeNotes.trim() || undefined,
          amountCollected: amountCollectedInput ? Number(amountCollectedInput) : undefined,
          completedAt: outcomeStatus === 'completed' || outcomeStatus === 'order_taken' ? new Date().toISOString() : undefined,
        };
      }
      return v;
    });

    const updatedTours = tours.map((t) => {
      if (t.id === activeTour.id) {
        return { ...t, dateVisits: updatedVisits };
      }
      return t;
    });

    const updatedTourObj = updatedTours.find((t) => t.id === activeTour.id);
    saveToursToStorage(updatedTours, updatedTourObj);
    toast.success(`Visit marked as "${outcomeStatus.replace('_', ' ').toUpperCase()}"!`);
    setCheckInVisit(null);
    setOutcomeNotes('');
    setAmountCollectedInput('');
  };

  return (
    <div className="space-y-6">
      {/* ─── Header & Month Workspace Selector ────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-zinc-200 print:hidden">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Monthly Multi-Tour Planner</h1>
            <Badge className="bg-amber-100 text-amber-900 border border-amber-300 text-xs font-bold font-mono">
              Multi-City Field Operations
            </Badge>
          </div>
          <p className="mt-1 text-xs text-zinc-500">
            Schedule multiple tours in a month across multiple cities while dynamically respecting client weekly off days.
          </p>
        </div>

        {/* Month & Year Workspace Switcher */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-white border border-zinc-200/80 rounded-xl p-1 shadow-2xs">
            <Select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              options={MONTHS.map((m) => ({ value: m, label: m }))}
              className="h-8 text-xs font-bold bg-transparent border-0 focus:ring-0"
            />
            <Select
              value={selectedYear.toString()}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              options={[
                { value: (currentYear - 1).toString(), label: (currentYear - 1).toString() },
                { value: currentYear.toString(), label: currentYear.toString() },
                { value: (currentYear + 1).toString(), label: (currentYear + 1).toString() },
              ]}
              className="h-8 text-xs font-bold bg-transparent border-0 focus:ring-0"
            />
          </div>

          <Button
            onClick={() => setIsReuseModalOpen(true)}
            variant="outline"
            className="h-10 px-4 rounded-xl text-xs font-bold border-amber-300 bg-amber-50/60 text-amber-900 hover:bg-amber-100 shadow-2xs"
          >
            🔁 Reuse Master Tour
          </Button>

          <Button
            onClick={handleOpenCreateTourModal}
            className="h-10 px-4 rounded-xl text-xs font-bold bg-amber-600 text-white shadow-md shadow-amber-600/20 hover:bg-amber-500 active:scale-95"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Create New Tour
          </Button>

          <Button
            onClick={() => window.print()}
            variant="outline"
            className="h-10 px-4 rounded-xl text-xs font-bold border-zinc-300 hover:bg-zinc-100"
          >
            <Printer className="w-4 h-4 mr-1.5 text-zinc-600" />
            Print Tour Master ({selectedTourClients.length})
          </Button>
        </div>
      </div>

      {/* ─── Printable Itinerary Header (Print View Only) ─────────────────── */}
      <div className="hidden print:block space-y-4 mb-6">
        <div className="border-b-2 border-zinc-900 pb-3">
          <h2 className="text-2xl font-bold text-zinc-900 uppercase">
            {activeTour ? activeTour.name : 'MONTHLY TOUR ITINERARY'}
          </h2>
          <p className="text-xs text-zinc-600">
            Schedule: <span className="font-bold text-zinc-900">{selectedMonth} {selectedYear}</span> | Cities: <span className="font-bold text-zinc-900">{activeTour?.cities.join(', ')}</span> | Target Clients: <span className="font-bold text-zinc-900">{selectedTourClients.length}</span>
          </p>
        </div>
      </div>

      {/* ─── Monthly Tours Ribbon ─────────────────────────────────────────── */}
      <div className="space-y-2 print:hidden">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-2">
            <Compass className="w-4 h-4 text-amber-700" />
            <span>Tours for {selectedMonth} {selectedYear}</span>
          </h3>
          <span className="text-xs text-zinc-500 font-mono font-medium">
            {monthlyTours.length} Tour{monthlyTours.length !== 1 ? 's' : ''} Configured
          </span>
        </div>

        {monthlyTours.length === 0 ? (
          <Card className="bg-amber-50/40 border border-amber-200/80 rounded-2xl p-6 text-center space-y-3">
            <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center mx-auto">
              <Compass className="w-5 h-5" />
            </div>
            <div className="space-y-1 max-w-md mx-auto">
              <h4 className="text-sm font-bold text-zinc-900">No tours planned for {selectedMonth} {selectedYear}</h4>
              <p className="text-xs text-zinc-500">
                Organize multi-city field trips by creating a named tour (e.g. Gujarat Belt, North Region, Local Outlets).
              </p>
            </div>
            <Button
              onClick={handleOpenCreateTourModal}
              className="h-9 px-4 text-xs font-bold rounded-xl bg-amber-700 text-white hover:bg-amber-800"
            >
              + Create First Tour for {selectedMonth}
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {monthlyTours.map((tour) => {
              const isActive = activeTour?.id === tour.id;
              return (
                <div
                  key={tour.id}
                  onClick={() => setActiveTourId(tour.id)}
                  className={`cursor-pointer rounded-2xl border p-4 transition-all duration-200 flex flex-col justify-between space-y-3 ${
                    isActive
                      ? 'bg-gradient-to-r from-zinc-900 via-zinc-900 to-amber-950 text-white border-zinc-800 shadow-md scale-[1.01]'
                      : 'bg-white text-zinc-900 border-zinc-200/80 hover:border-amber-400 hover:shadow-xs'
                  }`}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-sm font-extrabold leading-snug truncate">{tour.name}</h4>
                      <Badge
                        className={`text-[10px] font-mono font-bold shrink-0 ${
                          isActive ? 'bg-amber-500 text-zinc-950' : 'bg-zinc-100 text-zinc-700 border-zinc-200'
                        }`}
                      >
                        {tour.plannedVisitIds.length} Visited
                      </Badge>
                    </div>

                    {/* Cities Badges */}
                    <div className="flex flex-wrap gap-1 pt-1">
                      {tour.cities.map((city) => (
                        <span
                          key={city}
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            isActive
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                              : 'bg-amber-50 text-amber-800 border-amber-200'
                          }`}
                        >
                          📍 {city}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Card Actions */}
                  <div className={`pt-2 border-t flex items-center justify-between ${isActive ? 'border-zinc-800 text-zinc-300' : 'border-zinc-100 text-zinc-500'}`}>
                    <span className="text-[10px] font-medium">Created {new Date(tour.createdAt).toLocaleDateString()}</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenEditTourModal(tour);
                        }}
                        className={`p-1 rounded hover:bg-zinc-700/50 ${isActive ? 'text-zinc-300 hover:text-white' : 'text-zinc-500 hover:text-zinc-900'}`}
                        title="Edit Tour"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteTour(tour.id);
                        }}
                        className={`p-1 rounded hover:bg-rose-950/50 ${isActive ? 'text-rose-400 hover:text-rose-300' : 'text-zinc-400 hover:text-rose-600'}`}
                        title="Delete Tour"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ─── Active Tour Workspace Layout ──────────────────────────────────── */}
      {activeTour && (
        <div className="space-y-6 pt-2">
          {/* Date-Wise Tour Scheduler Bar inside Active Tour */}
          <Card className="bg-white rounded-2xl shadow-sm border border-zinc-200/80 p-5 space-y-4 print:hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-900 flex items-center justify-center font-bold">
                  <Calendar className="w-4 h-4 text-amber-700" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-zinc-900 uppercase tracking-wider">
                    Date-Wise Tour Schedule — <span className="text-amber-700">{activeTour.name}</span>
                  </h3>
                  <p className="text-xs text-zinc-500">
                    Select a target date to assign parties and build your exact date-by-date visit plan.
                  </p>
                </div>
              </div>

              {/* Target Date Picker & Smart Auto-Plan CTA */}
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  size="sm"
                  onClick={autoScheduleTourVisits}
                  className="h-8 px-3 text-xs font-bold rounded-xl bg-amber-700 text-white hover:bg-amber-800 shadow-xs flex items-center gap-1.5"
                  title="Auto-assign visit dates for all parties in this tour matching weekly off and preferred visit week"
                >
                  ⚡ Smart Auto-Plan Visits
                </Button>

                <div className="flex items-center gap-2 bg-amber-50/80 border border-amber-200/80 px-3 py-1.5 rounded-xl">
                  <label className="text-xs font-bold text-amber-950 shrink-0">Target Visit Date:</label>
                  <input
                    type="date"
                    value={targetVisitDate}
                    onChange={(e) => setTargetVisitDate(e.target.value)}
                    className="h-8 text-xs font-bold text-amber-900 bg-white border border-amber-300 rounded-lg px-2 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                  <Badge className="bg-amber-700 text-white font-bold text-[10px]">
                    {getDayNameFromDate(targetVisitDate)}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-zinc-500">Cities in Tour:</span>
                {activeTour.cities.map((city) => (
                  <span key={city} className="px-2 py-0.5 rounded-md bg-zinc-100 border border-zinc-200 text-zinc-800 font-semibold text-[11px]">
                    📍 {city}
                  </span>
                ))}
              </div>

              <div className="flex items-center gap-3">
                <span className="text-zinc-500">
                  Day of Week: <strong className="text-amber-800 font-bold">{getDayNameFromDate(targetVisitDate)}</strong>
                </span>
                <span className="text-zinc-300">•</span>
                <span className="text-zinc-500">
                  Total Scheduled: <strong className="text-zinc-900 font-bold">{(activeTour.dateVisits || []).length} Visits</strong>
                </span>
              </div>
            </div>
          </Card>

          {/* Directory & Itinerary Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Tour Customers Directory */}
            <div className="lg:col-span-2 space-y-3 print:hidden">
              {/* Search & Hide Closed Toggle */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
                  <Input
                    placeholder={`Search customers in ${activeTour.cities.join(', ')}...`}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 h-9 text-xs rounded-xl bg-white border-zinc-200"
                  />
                </div>
                <div className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-white border border-zinc-200 shrink-0">
                  <label className="text-[11px] font-bold text-zinc-700 cursor-pointer select-none" htmlFor="hide-closed-tour">
                    Hide Closed ({getDayNameFromDate(targetVisitDate)})
                  </label>
                  <input
                    id="hide-closed-tour"
                    type="checkbox"
                    checked={hideClosedClients}
                    onChange={(e) => setHideClosedClients(e.target.checked)}
                    className="h-4 w-4 rounded accent-amber-700 cursor-pointer ml-2"
                  />
                </div>
              </div>

              {isLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Card key={i} className="p-4 space-y-3 animate-pulse rounded-2xl bg-zinc-50">
                      <div className="h-4 bg-zinc-200 rounded w-3/4" />
                      <div className="h-3 bg-zinc-200 rounded w-1/2" />
                    </Card>
                  ))}
                </div>
              ) : tourClients.length === 0 ? (
                <Card className="bg-white rounded-2xl border border-zinc-200 p-8 text-center space-y-2">
                  <AlertTriangle className="w-8 h-8 text-amber-600 mx-auto" />
                  <p className="text-sm font-bold text-zinc-800">No customers found in selected cities</p>
                  <p className="text-xs text-zinc-500">
                    Cities in tour: <strong>{activeTour.cities.join(', ')}</strong>. Ensure customer addresses are registered with these cities.
                  </p>
                </Card>
              ) : (
                <div className="space-y-6">
                  {tourClientsByCity.map(({ city, clients }) => (
                    <div key={city} className="space-y-3">
                      {/* City Section Separator Bar */}
                      <div className="flex items-center gap-3 py-1">
                        <div className="h-px bg-amber-200/90 flex-1" />
                        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-amber-100/90 border border-amber-300/90 text-amber-950 text-xs font-extrabold shadow-2xs">
                          <MapPin className="w-3.5 h-3.5 text-amber-700" />
                          <span>{city}</span>
                          <Badge className="bg-amber-800 text-white font-mono text-[10px] px-1.5 py-0 rounded-md">
                            {clients.length} {clients.length === 1 ? 'party' : 'parties'}
                          </Badge>
                        </div>
                        <div className="h-px bg-amber-200/90 flex-1" />
                      </div>

                      {/* Compact Party Cards Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {clients.map((contact) => {
                          const dayNameOnTarget = getDayNameFromDate(targetVisitDate);
                          const isClosedOnDateDay = contact.weeklyOff?.toLowerCase() === dayNameOnTarget.toLowerCase();
                          const dateVisitsList = activeTour.dateVisits || [];
                          const isScheduledForTargetDate = dateVisitsList.some((v) => v.contactId === contact.id && v.date === targetVisitDate);
                          const assignedDatesForClient = dateVisitsList.filter((v) => v.contactId === contact.id).map((v) => v.date);
                          const mainAddress = contact.addresses?.[0];

                          return (
                            <Card
                              key={contact.id}
                              onClick={() => handleOpenPartyDateModal(contact)}
                              className={`rounded-xl border p-3 transition-all duration-200 flex flex-col justify-between space-y-2 cursor-pointer ${
                                isScheduledForTargetDate
                                  ? 'bg-amber-50/80 border-amber-400 shadow-xs'
                                  : isClosedOnDateDay
                                  ? 'bg-rose-50/40 border-rose-200 opacity-80 hover:opacity-100'
                                  : 'bg-white border-zinc-200/90 hover:border-amber-400 hover:shadow-xs'
                              }`}
                            >
                              <div className="space-y-1.5">
                                <div className="flex items-start justify-between gap-1.5">
                                  <div className="min-w-0 flex-1">
                                    <h4 className="text-xs font-bold text-zinc-900 leading-tight truncate">
                                      {contact.displayName}
                                    </h4>
                                    {contact.companyName && (
                                      <p className="text-[11px] font-semibold text-amber-800 truncate">
                                        {contact.companyName}
                                      </p>
                                    )}
                                  </div>
                                  <Badge
                                    className={`text-[9px] font-extrabold uppercase shrink-0 px-1.5 py-0 ${
                                      isClosedOnDateDay
                                        ? 'bg-rose-100 text-rose-800 border-rose-200'
                                        : 'bg-emerald-100 text-emerald-800 border-emerald-200'
                                    }`}
                                  >
                                    {isClosedOnDateDay ? `Closed` : 'Open'}
                                  </Badge>
                                </div>

                                <div className="text-[11px] text-zinc-500 space-y-0.5">
                                  {mainAddress && (
                                    <p className="truncate text-zinc-500">
                                      📍 {mainAddress.addressLine1}
                                    </p>
                                  )}
                                  {(contact.phone || contact.mobile) && (
                                    <p className="font-mono text-[10px] text-zinc-500">
                                      📞 {contact.mobile || contact.phone}
                                    </p>
                                  )}

                                  {assignedDatesForClient.length > 0 && (
                                    <div className="flex flex-wrap items-center gap-1 pt-0.5">
                                      {assignedDatesForClient.map((d) => (
                                        <span key={d} className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded bg-amber-100 text-amber-900 font-mono text-[9px] font-bold border border-amber-200">
                                          📅 {d}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>

                              <div className="pt-2 border-t border-zinc-100 flex items-center justify-between gap-1 text-[10px]">
                                <div className="text-zinc-500 space-x-1 truncate">
                                  <span>Bal: <strong className="text-amber-800 font-mono font-extrabold">{formatCurrency(Number((contact as any).balance ?? contact.openingBalance ?? 0))}</strong></span>
                                  <span className="text-zinc-300">•</span>
                                  <span>Off: <strong className="text-zinc-800 font-semibold">{contact.weeklyOff || 'None'}</strong></span>
                                </div>

                                <div className="flex items-center gap-1">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleOpenPartyDateModal(contact);
                                    }}
                                    className="h-6 px-2 text-[10px] font-bold rounded-md border-amber-300 text-amber-900 hover:bg-amber-100/60"
                                  >
                                    📅 Date
                                  </Button>

                                  <Button
                                    size="sm"
                                    disabled={isClosedOnDateDay}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      assignClientToDate(contact, targetVisitDate);
                                    }}
                                    className={`h-6 px-2 text-[10px] font-bold rounded-md transition-all ${
                                      isClosedOnDateDay
                                        ? 'bg-zinc-100 text-zinc-400 border border-zinc-200 cursor-not-allowed'
                                        : isScheduledForTargetDate
                                        ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                                        : 'bg-amber-700 text-white hover:bg-amber-800'
                                    }`}
                                  >
                                    {isClosedOnDateDay ? (
                                      `Closed`
                                    ) : isScheduledForTargetDate ? (
                                      <>
                                        <CheckCircle2 className="w-2.5 h-2.5 mr-0.5" /> Added
                                      </>
                                    ) : (
                                      `+ Add`
                                    )}
                                  </Button>
                                </div>
                              </div>
                            </Card>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Date-Wise Master Tour Itinerary Side Panel */}
            <div className="space-y-4 print:w-full print:col-span-3">
              <Card className="bg-white rounded-2xl shadow-sm border border-zinc-200/80 p-5 space-y-4 sticky top-6">
                <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
                  <div className="flex items-center gap-2">
                    <Navigation className="w-4 h-4 text-amber-700" />
                    <h3 className="text-sm font-extrabold text-zinc-900 uppercase tracking-wider">
                      Date-Wise Master Itinerary
                    </h3>
                  </div>
                  <Badge className="bg-amber-700 text-white font-mono font-bold">
                    {(activeTour.dateVisits || []).length} Scheduled Visits
                  </Badge>
                </div>

                {(!activeTour.dateVisits || activeTour.dateVisits.length === 0) ? (
                  <div className="py-12 text-center text-xs text-zinc-400 space-y-2">
                    <Clock className="w-8 h-8 text-zinc-300 mx-auto" />
                    <p className="font-bold text-zinc-600">No date-wise visits scheduled yet</p>
                    <p>Select a Target Date above and click "+ Schedule for [Date]" on customer cards to build your date-by-date itinerary.</p>
                  </div>
                ) : (
                  <div className="space-y-4 max-h-[560px] overflow-y-auto pr-1 custom-scrollbar">
                    {dateGroupedSchedule.map((group) => (
                      <div key={group.date} className="space-y-2">
                        <div className="flex items-center justify-between bg-amber-100/70 border border-amber-300/80 px-3 py-1.5 rounded-xl text-xs">
                          <span className="font-extrabold text-amber-950 flex items-center gap-1.5">
                            📅 {group.date} — <span className="text-amber-800 font-bold">{group.dayName}</span>
                          </span>
                          <div className="flex items-center gap-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openGoogleMapsRoute(group.visits)}
                              className="h-6 px-2 text-[10px] font-bold bg-white text-blue-700 border-blue-200 hover:bg-blue-50 rounded-lg shadow-2xs"
                              title="Open optimized multi-stop Google Maps route"
                            >
                              🗺️ Route
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => shareItineraryViaWhatsApp(group)}
                              className="h-6 px-2 text-[10px] font-bold bg-white text-emerald-700 border-emerald-200 hover:bg-emerald-50 rounded-lg shadow-2xs"
                              title="Share day's itinerary on WhatsApp"
                            >
                              💬 Share
                            </Button>
                            <Badge className="bg-amber-700 text-white font-mono text-[10px] px-1.5 py-0">
                              {group.visits.length}
                            </Badge>
                          </div>
                        </div>

                        <div className="space-y-2 pl-2">
                          {group.visits.map(({ assignment, contact }, index) => {
                            const addr = contact.addresses?.[0];
                            const status = assignment.status || 'scheduled';

                            return (
                              <div
                                key={assignment.id}
                                className={`p-3 rounded-xl border transition-all ${
                                  status === 'completed' || status === 'order_taken'
                                    ? 'bg-emerald-50/50 border-emerald-200'
                                    : status === 'follow_up'
                                    ? 'bg-amber-50/60 border-amber-200'
                                    : 'border-zinc-200/80 bg-zinc-50/70'
                                } flex items-start justify-between gap-3 text-xs`}
                              >
                                <div className="space-y-1 flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="w-5 h-5 rounded-full bg-amber-800 text-white text-[10px] font-extrabold flex items-center justify-center shrink-0">
                                      {index + 1}
                                    </span>
                                    <span className="font-bold text-zinc-900 truncate">{contact.displayName}</span>
                                    {status !== 'scheduled' && (
                                      <Badge
                                        className={`text-[9px] font-bold px-1.5 py-0 ${
                                          status === 'completed'
                                            ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                                            : status === 'order_taken'
                                            ? 'bg-blue-100 text-blue-800 border-blue-200'
                                            : 'bg-amber-100 text-amber-900 border-amber-300'
                                        }`}
                                      >
                                        {status.replace('_', ' ').toUpperCase()}
                                      </Badge>
                                    )}
                                  </div>

                                  {contact.companyName && (
                                    <p className="text-[11px] text-amber-800 font-semibold pl-7">
                                      {contact.companyName}
                                    </p>
                                  )}
                                  {addr && (
                                    <p className="text-[11px] text-zinc-500 pl-7 truncate">
                                      📍 {addr.addressLine1}, {addr.city}
                                    </p>
                                  )}
                                  {(contact.mobile || contact.phone) && (
                                    <p className="text-[11px] font-mono text-zinc-600 pl-7">
                                      📞 {contact.mobile || contact.phone}
                                    </p>
                                  )}
                                  <p className="text-[11px] text-zinc-600 pl-7 font-mono">
                                    Balance: <strong className="text-amber-800 font-extrabold">{formatCurrency(Number((contact as any).balance ?? contact.openingBalance ?? 0))}</strong>
                                  </p>

                                  {assignment.outcomeNotes && (
                                    <p className="text-[11px] text-zinc-600 pl-7 italic bg-white/70 p-1 rounded border border-zinc-200/50">
                                      📝 &quot;{assignment.outcomeNotes}&quot;
                                    </p>
                                  )}
                                </div>

                                <div className="flex flex-col items-end gap-1.5 shrink-0 print:hidden">
                                  <Button
                                    size="sm"
                                    onClick={() => {
                                      setCheckInVisit({ assignment, contact });
                                      setOutcomeStatus((assignment.status as any) || 'completed');
                                      setOutcomeNotes(assignment.outcomeNotes || '');
                                      setAmountCollectedInput(assignment.amountCollected ? String(assignment.amountCollected) : '');
                                    }}
                                    className="h-6 px-2 text-[10px] font-bold bg-white text-zinc-800 border border-zinc-200 hover:bg-zinc-100 rounded-lg shadow-2xs"
                                  >
                                    ✍️ Check-In
                                  </Button>
                                  <button
                                    onClick={() => removeDateVisit(assignment.id)}
                                    className="text-zinc-400 hover:text-rose-600 font-bold text-xs px-1"
                                    title="Remove visit for this date"
                                  >
                                    &times; Remove
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          </div>
        </div>
      )}

      {/* ─── Create / Edit Tour Modal ─────────────────────────────────────── */}
      <Dialog open={isTourModalOpen} onOpenChange={setIsTourModalOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl p-6 bg-white border border-zinc-200">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-zinc-900">
              {editingTourId ? 'Edit Monthly Tour Plan' : `Create Tour for ${selectedMonth} ${selectedYear}`}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSaveTour} className="space-y-4 pt-2">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1">
                Tour Name
              </label>
              <Input
                placeholder="e.g. Tour 1: Gujarat Industrial Belt"
                value={tourNameInput}
                onChange={(e) => setTourNameInput(e.target.value)}
                className="h-9 text-xs rounded-xl bg-zinc-50"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1">
                Select Multi-Cities for this Tour
              </label>
              {allCitiesList.length === 0 ? (
                <p className="text-xs text-zinc-400">No registered customer cities found in database.</p>
              ) : (
                <div className="grid grid-cols-2 gap-2 max-h-44 overflow-y-auto p-2 border border-zinc-200 rounded-xl bg-zinc-50/50">
                  {allCitiesList.map((cityName) => {
                    const isChecked = tourCitiesInput.includes(cityName);
                    return (
                      <label
                        key={cityName}
                        onClick={() => toggleCityInInput(cityName)}
                        className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all border ${
                          isChecked
                            ? 'bg-amber-100 border-amber-300 text-amber-900 font-bold'
                            : 'bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-100'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}} // handled by parent div
                          className="h-3.5 w-3.5 accent-amber-700 rounded"
                        />
                        <span className="truncate">{cityName}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1">
                Tour Notes & Objectives (Optional)
              </label>
              <Input
                placeholder="e.g. Target collection drive and new product catalog showcase..."
                value={tourNotesInput}
                onChange={(e) => setTourNotesInput(e.target.value)}
                className="h-9 text-xs rounded-xl bg-zinc-50"
              />
            </div>

            <div className="pt-3 border-t border-zinc-100 flex items-center justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsTourModalOpen(false)}
                className="h-9 px-4 text-xs font-semibold rounded-xl border-zinc-200"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="h-9 px-5 text-xs font-bold rounded-xl bg-amber-700 text-white hover:bg-amber-800"
              >
                {editingTourId ? 'Save Changes' : 'Create Tour'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ─── Party Date Selection Modal ───────────────────────────────────── */}
      <Dialog open={!!selectedPartyForDateModal} onOpenChange={(open) => !open && setSelectedPartyForDateModal(null)}>
        <DialogContent className="sm:max-w-md rounded-2xl p-6 bg-white border border-zinc-200">
          {selectedPartyForDateModal && (() => {
            const dayNameForModalDate = getDayNameFromDate(modalVisitDate);
            const isClosedOnModalDate = selectedPartyForDateModal.weeklyOff?.toLowerCase() === dayNameForModalDate.toLowerCase();
            const mainAddress = selectedPartyForDateModal.addresses?.[0];
            const currentPartyVisits = (activeTour?.dateVisits || []).filter((v) => v.contactId === selectedPartyForDateModal.id);

            return (
              <div className="space-y-4">
                <DialogHeader>
                  <DialogTitle className="text-base font-extrabold text-zinc-900 flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-amber-700" />
                    Schedule Visit for {selectedPartyForDateModal.displayName}
                  </DialogTitle>
                </DialogHeader>

                {/* Party Detail Summary Box */}
                <div className="p-3 rounded-xl bg-amber-50/60 border border-amber-200/80 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between font-bold text-amber-950">
                    <span>{selectedPartyForDateModal.companyName || selectedPartyForDateModal.displayName}</span>
                    <Badge className="bg-amber-700 text-white font-mono text-[10px]">
                      Off: {selectedPartyForDateModal.weeklyOff || 'None'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-[11px] pt-0.5 border-t border-amber-200/50">
                    <span className="text-zinc-600">Outstanding Balance:</span>
                    <strong className="text-amber-900 font-mono font-extrabold text-xs">
                      {formatCurrency(Number((selectedPartyForDateModal as any).balance ?? selectedPartyForDateModal.openingBalance ?? 0))}
                    </strong>
                  </div>
                  {mainAddress && (
                    <p className="text-[11px] text-zinc-600">
                      📍 {mainAddress.addressLine1}, {mainAddress.city}
                    </p>
                  )}
                  {(selectedPartyForDateModal.mobile || selectedPartyForDateModal.phone) && (
                    <p className="text-[11px] font-mono text-zinc-600">
                      📞 {selectedPartyForDateModal.mobile || selectedPartyForDateModal.phone}
                    </p>
                  )}
                </div>

                {/* Date Picker Section */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-600">
                    Select Target Visit Date *
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={modalVisitDate}
                      onChange={(e) => setModalVisitDate(e.target.value)}
                      className="h-10 text-xs font-bold text-zinc-900 bg-zinc-50 border border-zinc-300 rounded-xl px-3 flex-1 focus:outline-none focus:border-amber-600 focus:bg-white"
                      required
                    />
                    <Badge className="bg-amber-800 text-white font-bold text-xs h-10 px-3 flex items-center justify-center">
                      {dayNameForModalDate}
                    </Badge>
                  </div>
                </div>

                {/* Closed Day Alert Warning */}
                {isClosedOnModalDate && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 space-y-0.5">
                    <p className="font-bold flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-rose-600" />
                      Closed on {dayNameForModalDate}s!
                    </p>
                    <p className="text-[11px] text-rose-700">
                      {selectedPartyForDateModal.displayName} has a Weekly Off on {selectedPartyForDateModal.weeklyOff}. Please select a different open day for your visit.
                    </p>
                  </div>
                )}

                {/* Visit Notes / Objectives */}
                <div className="space-y-1">
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-600">
                    Visit Remarks / Objective (Optional)
                  </label>
                  <Input
                    placeholder="e.g. Payment collection, order review, catalog demo..."
                    value={modalVisitNotes}
                    onChange={(e) => setModalVisitNotes(e.target.value)}
                    className="h-9 text-xs rounded-xl bg-zinc-50"
                  />
                </div>

                {/* Currently Scheduled Visits for this Party */}
                {currentPartyVisits.length > 0 && (
                  <div className="space-y-1.5 border-t border-zinc-100 pt-2">
                    <p className="text-xs font-bold text-zinc-600">Scheduled Dates in this Tour:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {currentPartyVisits.map((v) => (
                        <span key={v.id} className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-amber-100 border border-amber-300 text-amber-950 font-mono text-xs font-bold">
                          📅 {v.date} ({getDayNameFromDate(v.date).substring(0, 3)})
                          <button
                            type="button"
                            onClick={() => removeDateVisit(v.id)}
                            className="text-amber-700 hover:text-rose-600 font-bold ml-1"
                            title="Remove date"
                          >
                            &times;
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Modal Action Buttons */}
                <div className="pt-3 border-t border-zinc-100 flex items-center justify-end gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setSelectedPartyForDateModal(null)}
                    className="h-9 px-4 text-xs font-semibold rounded-xl border-zinc-200"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    disabled={isClosedOnModalDate}
                    onClick={() => {
                      assignClientToDate(selectedPartyForDateModal, modalVisitDate, modalVisitNotes);
                      setSelectedPartyForDateModal(null);
                    }}
                    className={`h-9 px-5 text-xs font-bold rounded-xl ${
                      isClosedOnModalDate
                        ? 'bg-zinc-200 text-zinc-400 cursor-not-allowed'
                        : 'bg-amber-700 text-white hover:bg-amber-800'
                    }`}
                  >
                    Confirm Visit Date ({modalVisitDate})
                  </Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* ─── Reuse Saved Master Tour Modal ───────────────────────────────── */}
      <Dialog open={isReuseModalOpen} onOpenChange={setIsReuseModalOpen}>
        <DialogContent className="sm:max-w-lg rounded-2xl p-6 bg-white border border-zinc-200">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold text-zinc-900 flex items-center gap-2">
              🔁 Reuse Saved Master Tour Template
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-1">
            <p className="text-xs text-zinc-500">
              Select a saved master tour template below to activate it for <strong className="text-amber-800">{selectedMonth} {selectedYear}</strong>. All party visits will be automatically scheduled respecting weekly off days.
            </p>

            {masterTourTemplates.length === 0 ? (
              <div className="py-8 text-center text-xs text-zinc-400 space-y-1 bg-zinc-50 rounded-xl border border-zinc-200">
                <p className="font-bold text-zinc-600">No Master Tour templates saved yet.</p>
                <p>Create a tour first, and it will automatically be available here as a reusable template for future months.</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-80 overflow-y-auto pr-1 custom-scrollbar">
                {masterTourTemplates.map((template, idx) => {
                  const isAlreadyActive = monthlyTours.some((t) => t.name.toLowerCase() === template.name.toLowerCase());

                  return (
                    <div
                      key={idx}
                      className="p-4 rounded-xl border border-zinc-200/90 bg-zinc-50/70 flex items-center justify-between gap-4 transition-all hover:border-amber-400 hover:shadow-xs"
                    >
                      <div className="space-y-1.5 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-extrabold text-zinc-900 truncate">{template.name}</h4>
                          {isAlreadyActive && (
                            <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[9px] font-bold">
                              Active in {selectedMonth}
                            </Badge>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-1">
                          {template.cities.map((city) => (
                            <span key={city} className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100/80 text-amber-900 border border-amber-200/80">
                              📍 {city}
                            </span>
                          ))}
                        </div>

                        {template.notes && (
                          <p className="text-[11px] text-zinc-500 truncate">{template.notes}</p>
                        )}
                      </div>

                      <Button
                        size="sm"
                        disabled={isAlreadyActive}
                        onClick={() => handleReuseMasterTour(template)}
                        className={`h-8 px-3 text-xs font-bold rounded-xl shrink-0 ${
                          isAlreadyActive
                            ? 'bg-zinc-200 text-zinc-400 cursor-not-allowed'
                            : 'bg-amber-700 text-white hover:bg-amber-800'
                        }`}
                      >
                        {isAlreadyActive ? 'Already Active' : `Activate for ${selectedMonth}`}
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="pt-2 border-t border-zinc-100 flex justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsReuseModalOpen(false)}
                className="h-8 px-4 text-xs font-semibold rounded-xl border-zinc-200"
              >
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Live Check-In & Visit Outcome Modal ─────────────────────────────── */}
      <Dialog open={!!checkInVisit} onOpenChange={(open) => !open && setCheckInVisit(null)}>
        <DialogContent className="sm:max-w-md rounded-2xl p-6 bg-white border border-zinc-200 shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold text-zinc-900 flex items-center gap-2">
              ✍️ Client Visit Check-In & Outcome
            </DialogTitle>
          </DialogHeader>

          {checkInVisit && (
            <div className="space-y-4 pt-2">
              <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl space-y-1 text-xs">
                <p className="font-extrabold text-zinc-900 text-sm">{checkInVisit.contact.displayName}</p>
                {checkInVisit.contact.companyName && (
                  <p className="text-amber-900 font-semibold">{checkInVisit.contact.companyName}</p>
                )}
                <p className="text-zinc-600 font-mono">
                  Scheduled Date: <strong>{checkInVisit.assignment.date}</strong>
                </p>
                <p className="text-zinc-600 font-mono">
                  Current Balance: <strong className="text-amber-800">{formatCurrency(Number((checkInVisit.contact as any).balance ?? checkInVisit.contact.openingBalance ?? 0))}</strong>
                </p>
              </div>

              {/* Outcome Status Selector */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1.5">
                  Visit Outcome Status
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'completed', label: '✅ Completed (General)', color: 'border-emerald-300 hover:bg-emerald-50 text-emerald-950' },
                    { id: 'order_taken', label: '📦 Order Taken', color: 'border-blue-300 hover:bg-blue-50 text-blue-950' },
                    { id: 'follow_up', label: '⏰ Follow-up Needed', color: 'border-amber-300 hover:bg-amber-50 text-amber-950' },
                    { id: 'rescheduled', label: '🔄 Rescheduled', color: 'border-purple-300 hover:bg-purple-50 text-purple-950' },
                  ].map((st) => (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => setOutcomeStatus(st.id as any)}
                      className={`p-2 rounded-xl border text-xs font-bold text-left transition-all ${
                        outcomeStatus === st.id
                          ? 'bg-amber-100 border-amber-700 text-amber-950 ring-1 ring-amber-700'
                          : `bg-white border-zinc-200 ${st.color}`
                      }`}
                    >
                      {st.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Payment Collected (Optional) */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1">
                  Payment / Cheque Collected (₹) <span className="text-zinc-400 font-normal">(Optional)</span>
                </label>
                <Input
                  type="number"
                  placeholder="e.g. 15000"
                  value={amountCollectedInput}
                  onChange={(e) => setAmountCollectedInput(e.target.value)}
                  className="h-9 text-xs rounded-xl bg-zinc-50 font-mono"
                />
              </div>

              {/* Outcome Discussion Notes */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1">
                  Discussion Summary & Next Action
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g. Discussed new catalogue, sample approved, agreed to clear pending bill by Friday."
                  value={outcomeNotes}
                  onChange={(e) => setOutcomeNotes(e.target.value)}
                  className="w-full p-2.5 text-xs rounded-xl bg-zinc-50 border border-zinc-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-2 border-t border-zinc-100 flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setCheckInVisit(null)}
                  className="h-8 text-xs rounded-xl"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleSaveCheckIn}
                  className="h-8 px-4 text-xs font-bold rounded-xl bg-amber-700 hover:bg-amber-800 text-white"
                >
                  Save Outcome
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
